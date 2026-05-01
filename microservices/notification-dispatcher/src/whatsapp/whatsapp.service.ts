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

// Logger compatible con Baileys (pino), silenciado en producción
const baileysLogger = pino({ level: 'silent' });

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WhatsappService.name);
    private socket: WASocket | null = null;

    constructor(
        @InjectRepository(WhatsappSession)
        private readonly sessionRepo: Repository<WhatsappSession>,
        @InjectRepository(CompanyReplica)
        private readonly companyRepo: Repository<CompanyReplica>,
    ) { }

    async onModuleInit() {
        //  await this.connect();
    }

    async onModuleDestroy() {
        this.socket?.end(undefined);
        this.socket = null;
    }

    async connect(): Promise<void> {
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
        });

        this.socket.ev.on('creds.update', async () => {
            await saveCreds();
            this.logger.log('Credenciales guardadas en base de datos ✅');
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
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const loggedOut = statusCode === DisconnectReason.loggedOut;
                this.socket = null;

                if (loggedOut) {
                    this.logger.warn('Sesión cerrada por logout. Limpiando credenciales...');
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
                } else {
                    this.logger.warn(`Conexión cerrada (código ${statusCode}). Reconectando en 3 s...`);
                    setTimeout(() => this.connect(), 3_000);
                }
            }
        });

        this.socket.ev.on('messages.upsert', ({ messages, type }) => {
            if (type === 'notify') {
                this.logger.log(`Mensaje recibido de ${messages[0]?.key?.remoteJid}`);
            }
        });
    }

    // ─── API pública ──────────────────────────────────────────────────────────

    async sendText(to: string, text: string) {
        if (!this.socket) throw new Error('WhatsApp no está conectado');
        return this.socket.sendMessage(this.toJid(to), { text });
    }

    async sendImage(to: string, imageBuffer: Buffer, caption?: string) {
        if (!this.socket) throw new Error('WhatsApp no está conectado');
        return this.socket.sendMessage(this.toJid(to), { image: imageBuffer, caption });
    }

    isConnected(): boolean {
        return this.socket !== null;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Normaliza un número al formato E.164 sin '+' para WhatsApp JID.
     *
     * Ejemplos:
     *   "0983249741"    → "593983249741"   (Ecuador: reemplaza 0 por 593)
     *   "+593983249741" → "593983249741"   (quita el +)
     *   "593983249741"  → "593983249741"   (ya estaba bien)
     */
    private normalizePhone(phone: string): string {
        let digits = phone.replace(/\D/g, ''); // eliminar todo lo que no sea dígito

        if (digits.startsWith('0')) {
            digits = '593' + digits.slice(1); // 09XXXXXXXX → 593 9XXXXXXXX
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