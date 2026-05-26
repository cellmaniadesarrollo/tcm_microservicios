import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import makeWASocket, {
    DisconnectReason,
    WASocket,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { useDatabaseAuthState } from './utils/database-auth-state.util';

const baileysLogger = pino({ level: 'silent' });

/** Segundos de inactividad tras el último envío antes de cerrar el socket */
const POST_SEND_DISCONNECT_MS = 30_000; // 30 s

// ─── ✏️ AJUSTA AQUÍ EL RANGO DEL DELAY ENTRE MENSAJES ────────────────────────
//
//  SEND_DELAY_MIN_MS : tiempo mínimo de espera entre mensajes
//  SEND_DELAY_MAX_MS : tiempo máximo de espera entre mensajes
//
//  Ejemplos de configuración:
//    Conservador (recomendado): MIN = 4_000  MAX = 9_000   → entre 4 y 9 segundos
//    Moderado                 : MIN = 2_500  MAX = 6_000   → entre 2.5 y 6 segundos
//    Agresivo (más riesgo)    : MIN = 1_500  MAX = 4_000   → entre 1.5 y 4 segundos
//
const SEND_DELAY_MIN_MS = 4_000;
const SEND_DELAY_MAX_MS = 9_000;
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WhatsappService.name);

    private socket: WASocket | null = null;

    /** true → cierre intencional, no reconectar */
    private sleeping = false;

    /** Resuelve cuando connection === 'open' */
    private connectionPromise: Promise<void> | null = null;
    private connectionResolve: (() => void) | null = null;

    /** Cierra el socket N ms después del último envío */
    private disconnectTimer: NodeJS.Timeout | null = null;

    /** Cola secuencial: cada envío espera al anterior */
    private sendQueue: Promise<void> = Promise.resolve();

    /** Cuándo se hizo el último envío real */
    private lastSentAt: number = 0;

    constructor(
        @InjectRepository(WhatsappSession)
        private readonly sessionRepo: Repository<WhatsappSession>,
        @InjectRepository(CompanyReplica)
        private readonly companyRepo: Repository<CompanyReplica>,
    ) { }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    async onModuleInit() {
        this.logger.log('WhatsappService listo. Socket bajo demanda 💤');
    }

    async onModuleDestroy() {
        this.sleeping = true;
        this.clearDisconnectTimer();
        this.socket?.end(undefined);
        this.socket = null;
    }

    // ─── Conexión ─────────────────────────────────────────────────────────────

    async connect(): Promise<void> {
        this.sleeping = false;

        this.connectionPromise = new Promise<void>((resolve) => {
            this.connectionResolve = resolve;
        });

        const session = await this.getOrCreateSession();

        if (!session.creds) {
            this.logger.warn('══════════════════════════════════════════════');
            this.logger.warn('  No hay sesión guardada. Generando QR...');
            this.logger.warn('══════════════════════════════════════════════');
        } else {
            this.logger.log('Sesión encontrada en BD, reconectando...');
        }

        const { state, saveCreds } = await useDatabaseAuthState(session, this.sessionRepo);
        const { version } = await fetchLatestBaileysVersion();

        this.socket = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
            },
            logger: baileysLogger,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            fireInitQueries: false,
        });

        this.socket.ev.on('creds.update', async () => {
            await saveCreds();
            this.logger.log('Credenciales guardadas en BD ✅');
        });

        this.socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                this.logger.warn('Escanea este QR con WhatsApp:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                const phone = this.socket?.user?.id?.split(':')[0] ?? 'desconocido';
                this.logger.log('══════════════════════════════════════════════');
                this.logger.log(`  WhatsApp conectado como: ${phone} ✅`);
                this.logger.log('══════════════════════════════════════════════');

                await this.sessionRepo.update(session.id, {
                    status: 'CONNECTED',
                    phoneNumber: phone,
                });

                this.connectionResolve?.();
                this.connectionResolve = null;
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const loggedOut = statusCode === DisconnectReason.loggedOut;
                this.socket = null;
                this.connectionPromise = null;
                this.clearDisconnectTimer();

                if (loggedOut) {
                    this.logger.warn('Logout detectado. Limpiando credenciales...');
                    await this.sessionRepo
                        .createQueryBuilder()
                        .update()
                        .set({
                            status: 'DISCONNECTED',
                            creds: () => 'NULL',
                            keys: () => 'NULL',
                            phoneNumber: () => 'NULL',
                        })
                        .where('id = :id', { id: session.id })
                        .execute();
                    this.logger.warn('Reinicia el servidor para vincular una nueva cuenta.');

                } else if (!this.sleeping) {
                    this.logger.warn(`Conexión cerrada (código ${statusCode}). Reconectando en 3 s...`);
                    setTimeout(() => this.connect(), 3_000);

                } else {
                    this.logger.log('Socket cerrado correctamente 💤');
                }
            }
        });
    }

    // ─── Sleep / Wake ─────────────────────────────────────────────────────────

    private async wake(): Promise<void> {
        if (this.socket) return;

        if (!this.connectionPromise) {
            this.logger.log('Despertando socket para envío... ⏰');
            await this.connect();
        }

        await this.connectionPromise;
    }

    private sleep(): void {
        if (!this.socket) return;
        this.logger.log('Sin actividad. Cerrando socket 💤');
        this.sleeping = true;
        this.socket.end(undefined);
        this.socket = null;
    }

    // ─── Timer post-envío ─────────────────────────────────────────────────────

    private scheduleDisconnect(): void {
        this.clearDisconnectTimer();
        this.disconnectTimer = setTimeout(() => this.sleep(), POST_SEND_DISCONNECT_MS);
    }

    private clearDisconnectTimer(): void {
        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = null;
        }
    }

    // ─── Cola con delay ───────────────────────────────────────────────────────

    private randomDelay(): Promise<void> {
        const ms =
            Math.floor(Math.random() * (SEND_DELAY_MAX_MS - SEND_DELAY_MIN_MS + 1)) +
            SEND_DELAY_MIN_MS;
        this.logger.debug(`Esperando ${ms}ms antes del próximo envío...`);
        return new Promise((r) => setTimeout(r, ms));
    }

    /**
     * Encola el envío: espera a que termine el anterior y aplica
     * un delay aleatorio si el último envío fue reciente.
     */
    private enqueue<T>(task: () => Promise<T>): Promise<T> {
        const result = this.sendQueue.then(async () => {
            const elapsed = Date.now() - this.lastSentAt;
            if (this.lastSentAt > 0 && elapsed < SEND_DELAY_MAX_MS) {
                await this.randomDelay();
            }

            // Creamos una carrera: o el envío responde, o el temporizador de 12s lo tumba
            return await Promise.race([
                task(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout: El envío de WhatsApp tardó demasiado en responder')), 12_000)
                )
            ]);
        });

        this.sendQueue = result.then(
            () => { this.lastSentAt = Date.now(); },
            () => { this.lastSentAt = Date.now(); }, // Avanzar la estampa de tiempo incluso si falló
        );

        return result;
    }

    // ─── API pública ──────────────────────────────────────────────────────────

    async sendText(to: string, text: string) {
        return this.enqueue(async () => {
            await this.wake();
            if (!this.socket) throw new Error('No se pudo establecer la conexión con el socket de WhatsApp');

            const result = await this.socket.sendMessage(this.toJid(to), { text });
            this.scheduleDisconnect();
            return result;
        });
    }

    async sendImage(to: string, imageBuffer: Buffer, caption?: string) {
        return this.enqueue(async () => {
            await this.wake();
            const result = await this.socket!.sendMessage(this.toJid(to), {
                image: imageBuffer,
                caption,
            });
            this.scheduleDisconnect();
            return result;
        });
    }

    async sendDocument(
        to: string,
        fileBuffer: Buffer,
        fileName: string,
        mimetype: string,
        caption?: string,
    ) {
        return this.enqueue(async () => {
            await this.wake();
            const result = await this.socket!.sendMessage(this.toJid(to), {
                document: fileBuffer,
                fileName,
                mimetype,
                caption,
            });
            this.scheduleDisconnect();
            return result;
        });
    }

    isConnected(): boolean {
        return this.socket !== null;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private normalizePhone(phone: string): string {
        // 1. Quitar cualquier carácter que no sea un número (elimina +, espacios, guiones)
        let digits = phone.replace(/\D/g, '');

        // 2. Si el número empieza con el formato local '09...', reemplazar el '0' por '593'
        if (digits.startsWith('0')) {
            digits = '593' + digits.slice(1);
        }

        // 3. ¡EL PARCHE!: Si el número ya viene con '59309...', eliminar ese '0' sobrante
        if (digits.startsWith('5930')) {
            digits = '593' + digits.slice(4); // Mantiene el 593 y salta el 0
        }

        return digits;
    }

    private toJid(phone: string): string {
        const normalized = this.normalizePhone(phone);
        return normalized.includes('@') ? normalized : `${normalized}@s.whatsapp.net`;
    }

    private async getOrCreateSession(): Promise<WhatsappSession> {
        const existing = await this.sessionRepo.findOne({ where: {} });
        if (existing) return existing;

        const company = await this.companyRepo.findOne({ where: {} });
        if (!company) {
            throw new Error(
                'No existe ninguna CompanyReplica en la BD. ' +
                'Asegúrate de que el evento de sincronización de company haya llegado primero.',
            );
        }

        this.logger.log(`Creando sesión para company: ${company.id}`);
        return this.sessionRepo.save(
            this.sessionRepo.create({ company, status: 'DISCONNECTED' }),
        );
    }
}