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

    constructor(
        @InjectRepository(WhatsappSession)
        private readonly sessionRepo: Repository<WhatsappSession>,
        @InjectRepository(CompanyReplica)
        private readonly companyRepo: Repository<CompanyReplica>,
    ) { }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    async onModuleInit() {
        // No conectar al arrancar — solo cuando haya algo que enviar
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
            // ── Anti-ban: mínima huella posible ──
            markOnlineOnConnect: false,  // no aparece "en línea"
            syncFullHistory: false,      // no descarga historial
            fireInitQueries: false,      // menos queries al conectar
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

                // Desbloquea todos los sendText/sendImage que estuvieran esperando
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
                    // Caída accidental durante un envío → reconectar
                    this.logger.warn(`Conexión cerrada (código ${statusCode}). Reconectando en 3 s...`);
                    setTimeout(() => this.connect(), 3_000);

                } else {
                    this.logger.log('Socket cerrado correctamente 💤');
                }
            }
        });

        // ← Sin messages.upsert intencionalmente:
        //   no procesamos mensajes entrantes → menos huella de bot
    }

    // ─── Sleep / Wake ─────────────────────────────────────────────────────────

    /**
     * Si el socket está dormido, lo levanta y espera a que esté 'open'.
     * Si ya hay una conexión en curso, espera esa misma promesa (no duplica).
     * Si ya está conectado, retorna de inmediato.
     */
    private async wake(): Promise<void> {
        if (this.socket) return;

        if (!this.connectionPromise) {
            this.logger.log('Despertando socket para envío... ⏰');
            await this.connect();
        }

        await this.connectionPromise;
    }

    /** Cierre intencional del socket */
    private sleep(): void {
        if (!this.socket) return;
        this.logger.log('Sin actividad. Cerrando socket 💤');
        this.sleeping = true;
        this.socket.end(undefined);
        this.socket = null;
    }

    // ─── Timer post-envío ─────────────────────────────────────────────────────

    /**
     * Cada envío reinicia la cuenta regresiva.
     * Si pasan POST_SEND_DISCONNECT_MS sin otro envío → sleep.
     */
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

    // ─── API pública ──────────────────────────────────────────────────────────

    async sendText(to: string, text: string) {
        await this.wake();
        const result = await this.socket!.sendMessage(this.toJid(to), { text });
        this.scheduleDisconnect();
        return result;
    }

    async sendImage(to: string, imageBuffer: Buffer, caption?: string) {
        await this.wake();
        const result = await this.socket!.sendMessage(this.toJid(to), {
            image: imageBuffer,
            caption,
        });
        this.scheduleDisconnect();
        return result;
    }

    async sendDocument(
        to: string,
        fileBuffer: Buffer,
        fileName: string,
        mimetype: string,
        caption?: string,
    ) {
        await this.wake();
        const result = await this.socket!.sendMessage(this.toJid(to), {
            document: fileBuffer,
            fileName,
            mimetype,
            caption,
        });
        this.scheduleDisconnect();
        return result;
    }

    isConnected(): boolean {
        return this.socket !== null;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Normaliza un número al formato E.164 sin '+' para WhatsApp JID.
     *
     * Ejemplos:
     *   "0983249741"    → "593983249741"
     *   "+593983249741" → "593983249741"
     *   "593983249741"  → "593983249741"
     */
    private normalizePhone(phone: string): string {
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('0')) {
            digits = '593' + digits.slice(1);
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