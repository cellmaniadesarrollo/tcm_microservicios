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
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { useDatabaseAuthState } from './utils/database-auth-state.util';
import { WhatsappRouting } from './entities/whatsapp-routing.entity';

const baileysLogger = pino({ level: 'silent' });
const POST_SEND_DISCONNECT_MS = 30_000;
const SEND_DELAY_MIN_MS = 4_000;
const SEND_DELAY_MAX_MS = 9_000;

interface SessionRuntime {
    socket: WASocket;
    qr: string | null;
    sendQueue: Promise<void>;
    lastSentAt: number;
    disconnectTimer: NodeJS.Timeout | null;
    intentionalClose: boolean;
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WhatsappService.name);

    /** sessionId → runtime activo */
    private runtimes = new Map<string, SessionRuntime>();

    /** sessionId → promise que resuelve cuando el socket abre */
    private linkingPromises = new Map<string, Promise<void>>();

    constructor(
        @InjectRepository(WhatsappSession)
        private readonly sessionRepo: Repository<WhatsappSession>,
        @InjectRepository(CompanyReplica)
        private readonly companyRepo: Repository<CompanyReplica>,
        @InjectRepository(WhatsappRouting)
        private readonly routingRepo: Repository<WhatsappRouting>,
    ) { }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    async onModuleInit() {
        this.logger.log('WhatsappService iniciado 💤');
        await this.seedRoutingRules();
    }

    async onModuleDestroy() {
        for (const [, rt] of this.runtimes) {
            this.clearTimer(rt);
            rt.socket.end(undefined);
        }
        this.runtimes.clear();
    }

    // ─── Seed routing ─────────────────────────────────────────────────────────

    private async seedRoutingRules() {
        const count = await this.routingRepo.count();
        if (count > 0) return;

        await this.routingRepo.save([
            this.routingRepo.create({ name: 'ALL', purpose: 'ALL' }),
            this.routingRepo.create({ name: 'NOTIFICATIONS', purpose: 'NOTIFICATIONS' }),
            this.routingRepo.create({ name: 'REMINDERS', purpose: 'REMINDERS' }),
        ]);
        this.logger.log('Routing rules creadas ✅');
    }

    // ─── Sesiones CRUD ────────────────────────────────────────────────────────

    async listSessions(companyId: string): Promise<WhatsappSession[]> {
        return this.sessionRepo.find({
            where: { companyId },
            relations: ['routing'],
            order: { createdAt: 'ASC' },
        });
    }

    async listRoutingTypes(): Promise<WhatsappRouting[]> {
        return this.routingRepo.find({ order: { name: 'ASC' } });
    }

    /** Solo crea el registro. No abre socket ni genera QR. */
    async createSession(companyId: string, routingId: string): Promise<WhatsappSession> {
        const routing = await this.routingRepo.findOne({ where: { id: routingId } });
        if (!routing) throw new Error(`Routing ${routingId} no existe`);

        const company = await this.companyRepo.findOne({ where: { id: companyId } });
        if (!company) throw new Error(`Empresa ${companyId} no encontrada`);

        // Si ya existe sesión con ese routing la eliminamos (evitar duplicados)
        const existing = await this.sessionRepo.findOne({ where: { companyId, routingId } });
        if (existing) {
            this.killRuntime(existing.id);           // cierra socket si estaba vivo
            await this.sessionRepo.remove(existing);
        }

        const session = this.sessionRepo.create({
            company,
            companyId,
            routingId,
            status: 'DISCONNECTED',
        });
        return this.sessionRepo.save(session);
    }

    async updateSessionRouting(
        companyId: string,
        sessionId: string,
        routingId: string,
    ): Promise<WhatsappSession> {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId, companyId } });
        if (!session) throw new Error(`Sesión ${sessionId} no encontrada`);

        const routing = await this.routingRepo.findOne({ where: { id: routingId } });
        if (!routing) throw new Error(`Routing ${routingId} no existe`);

        // Eliminar posible conflicto
        const duplicate = await this.sessionRepo.findOne({ where: { companyId, routingId } });
        if (duplicate && duplicate.id !== sessionId) {
            this.killRuntime(duplicate.id);
            await this.sessionRepo.remove(duplicate);
        }

        // Matar el runtime actual de esta sesión (queda desvinculada)
        this.killRuntime(sessionId);

        await this.sessionRepo
            .createQueryBuilder()
            .update()
            .set({ routingId, status: 'DISCONNECTED', creds: () => 'NULL', keys: () => 'NULL', phoneNumber: () => 'NULL' })
            .where('id = :id', { id: sessionId })
            .execute();

        return this.sessionRepo.findOne({ where: { id: sessionId }, relations: ['routing'] }) as Promise<WhatsappSession>;
    }

    async deleteSession(companyId: string, sessionId: string): Promise<{ deleted: boolean }> {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId, companyId } });
        if (!session) throw new Error(`Sesión ${sessionId} no encontrada`);
        this.killRuntime(sessionId);
        await this.sessionRepo.remove(session);
        return { deleted: true };
    }

    // ─── Vinculación (QR) ─────────────────────────────────────────────────────

    /**
     * Abre el socket para una sesión específica y genera su QR.
     * Si ya está vinculada (CONNECTED) no hace nada.
     */
    async linkSession(companyId: string, sessionId: string): Promise<{ linking: boolean }> {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId, companyId } });
        if (!session) throw new Error(`Sesión ${sessionId} no encontrada`);

        if (this.runtimes.has(sessionId)) {
            this.logger.log(`Sesión ${sessionId} ya tiene socket activo`);
            return { linking: false };
        }

        this.logger.log(`Iniciando vinculación de sesión ${sessionId}...`);
        // Arrancamos sin await: el QR se guarda en runtime y el frontend lo consulta
        this.openSocket(session).catch((err) =>
            this.logger.error(`Error al vincular sesión ${sessionId}:`, err),
        );

        return { linking: true };
    }

    /** Devuelve el QR (base64 PNG) de una sesión concreta. */
    getQrStatus(sessionId: string): {
        qr: string | null;
        status: 'waiting_qr' | 'connected' | 'disconnected';
    } {
        const rt = this.runtimes.get(sessionId);
        if (!rt) return { qr: null, status: 'disconnected' };
        if (rt.qr) return { qr: rt.qr, status: 'waiting_qr' };
        return { qr: null, status: 'connected' };
    }

    // ─── Socket interno ───────────────────────────────────────────────────────

    private async openSocket(session: WhatsappSession): Promise<void> {
        const { state, saveCreds } = await useDatabaseAuthState(session, this.sessionRepo);
        const { version } = await fetchLatestBaileysVersion();

        this.logger.log(`Usando versión WA: ${version}`);
        const socket = makeWASocket({
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

        // Runtime inicial (sin qr todavía)
        const rt: SessionRuntime = {
            socket,
            qr: null,
            sendQueue: Promise.resolve(),
            lastSentAt: 0,
            disconnectTimer: null,
            intentionalClose: false,
        };
        this.runtimes.set(session.id, rt);

        socket.ev.on('creds.update', () => saveCreds());

        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // ─── LOG COMPLETO DEL UPDATE ──────────────────────────────────────────
            this.logger.log(`[${session.id}] connection.update recibido: ${JSON.stringify({
                connection,
                qr: qr ? `QR_PRESENTE (${qr.length} chars)` : null,
                lastDisconnect: lastDisconnect ? {
                    statusCode: (lastDisconnect.error as Boom)?.output?.statusCode,
                    message: (lastDisconnect.error as Boom)?.message,
                } : null,
            })}`);

            if (qr) {
                rt.qr = qr;
                this.logger.log(`[${session.id}] QR generado ✅`);
            }

            if (connection === 'open') {
                rt.qr = null;
                const phone = socket.user?.id?.split(':')[0] ?? 'desconocido';
                this.logger.log(`[${session.id}] Conectado como ${phone} ✅`);
                await this.sessionRepo.update(session.id, { status: 'CONNECTED', phoneNumber: phone });
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const loggedOut = statusCode === DisconnectReason.loggedOut;
                const restartRequired = statusCode === DisconnectReason.restartRequired;
                const conflict = statusCode === 401;
                const wasIntentional = rt.intentionalClose; // ← leer antes de borrar el runtime

                this.runtimes.delete(session.id);
                this.linkingPromises.delete(session.id);

                // ✅ Si fue cierre intencional (delete/update routing), no hacer nada
                if (wasIntentional) {
                    this.logger.log(`[${session.id}] Cierre intencional. No reconectar.`);
                    return;
                }

                if (loggedOut) {
                    this.logger.warn(`[${session.id}] Logout real. Limpiando credenciales...`);
                    await this.sessionRepo.createQueryBuilder().update()
                        .set({ status: 'DISCONNECTED', creds: () => 'NULL', keys: () => 'NULL', phoneNumber: () => 'NULL' })
                        .where('id = :id', { id: session.id })
                        .execute();

                } else if (conflict) {
                    // ✅ Conflict = otra sesión activa, NO limpiar creds, solo marcar desconectado
                    this.logger.warn(`[${session.id}] Conflicto de sesión (401). Marcando desconectado sin limpiar creds.`);
                    await this.sessionRepo.update(session.id, { status: 'DISCONNECTED' });

                } else if (restartRequired) {
                    this.logger.warn(`[${session.id}] Restart requerido. Reconectando en 3s...`);
                    const freshSession = await this.sessionRepo.findOne({ where: { id: session.id } });
                    if (freshSession) setTimeout(() => this.openSocket(freshSession), 3_000);

                } else {
                    this.logger.warn(`[${session.id}] Cierre inesperado (código ${statusCode}). Reconectando en 3s...`);
                    setTimeout(() => this.openSocket(session), 3_000);
                }
            }
        });
    }

    /** Cierra y elimina el runtime de una sesión sin tocar la BD. */
    private killRuntime(sessionId: string): void {
        const rt = this.runtimes.get(sessionId);
        if (!rt) return;
        this.clearTimer(rt);
        rt.intentionalClose = true; // ← marcar antes de cerrar
        try {
            rt.socket.end(undefined);
        } catch (_) { }
        this.runtimes.delete(sessionId);
        this.linkingPromises.delete(sessionId);
        this.logger.log(`Runtime de sesión ${sessionId} destruido`);
    }

    // ─── Envíos ───────────────────────────────────────────────────────────────

    async sendText(sessionId: string, to: string, text: string) {
        return this.enqueue(sessionId, async (socket) => {
            return socket.sendMessage(this.toJid(to), { text });
        });
    }

    async sendImage(sessionId: string, to: string, imageBuffer: Buffer, caption?: string) {
        return this.enqueue(sessionId, async (socket) => {
            return socket.sendMessage(this.toJid(to), { image: imageBuffer, caption });
        });
    }

    async sendDocument(
        sessionId: string,
        to: string,
        fileBuffer: Buffer,
        fileName: string,
        mimetype: string,
        caption?: string,
    ) {
        return this.enqueue(sessionId, async (socket) => {
            return socket.sendMessage(this.toJid(to), { document: fileBuffer, fileName, mimetype, caption });
        });
    }

    // ─── Cola con delay por sesión ────────────────────────────────────────────

    private enqueue<T>(sessionId: string, task: (socket: WASocket) => Promise<T>): Promise<T> {
        const rt = this.runtimes.get(sessionId);
        if (!rt) throw new Error(`Sesión ${sessionId} no tiene socket activo`);

        const result = rt.sendQueue.then(async () => {
            const elapsed = Date.now() - rt.lastSentAt;
            if (rt.lastSentAt > 0 && elapsed < SEND_DELAY_MAX_MS) {
                await this.randomDelay();
            }
            return Promise.race([
                task(rt.socket),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout: WhatsApp tardó demasiado')), 12_000),
                ),
            ]);
        });

        rt.sendQueue = result.then(
            () => { rt.lastSentAt = Date.now(); this.scheduleDisconnect(sessionId); },
            () => { rt.lastSentAt = Date.now(); },
        );

        return result;
    }

    private randomDelay(): Promise<void> {
        const ms = Math.floor(Math.random() * (SEND_DELAY_MAX_MS - SEND_DELAY_MIN_MS + 1)) + SEND_DELAY_MIN_MS;
        return new Promise((r) => setTimeout(r, ms));
    }

    private scheduleDisconnect(sessionId: string): void {
        const rt = this.runtimes.get(sessionId);
        if (!rt) return;
        this.clearTimer(rt);
        rt.disconnectTimer = setTimeout(() => {
            this.logger.log(`Sesión ${sessionId} sin actividad. Cerrando socket 💤`);
            rt.socket.end(undefined);
            this.runtimes.delete(sessionId);
        }, POST_SEND_DISCONNECT_MS);
    }

    private clearTimer(rt: SessionRuntime): void {
        if (rt.disconnectTimer) {
            clearTimeout(rt.disconnectTimer);
            rt.disconnectTimer = null;
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private normalizePhone(phone: string): string {
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('0')) digits = '593' + digits.slice(1);
        if (digits.startsWith('5930')) digits = '593' + digits.slice(4);
        return digits;
    }

    private toJid(phone: string): string {
        const normalized = this.normalizePhone(phone);
        return normalized.includes('@') ? normalized : `${normalized}@s.whatsapp.net`;
    }
}