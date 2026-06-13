// src/whatsapp/whatsapp.service.ts

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
import { toJid, randomDelay, withTimeout } from './helpers/whatsapp.helpers';
import { MessagePurpose } from './entities/whatsapp-routing.entity';

const baileysLogger = pino({ level: 'silent' });
const POST_SEND_DISCONNECT_MS = 30_000;
const SEND_DELAY_MIN_MS = 4_000;
const SEND_DELAY_MAX_MS = 9_000;
const LAZY_CONNECT_TIMEOUT_MS = 20_000;

interface SessionRuntime {
    sessionId: string;
    socket: WASocket;
    qr: string | null;
    isOpen: boolean;
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

    async createSession(companyId: string, routingId: string): Promise<WhatsappSession> {
        const routing = await this.routingRepo.findOne({ where: { id: routingId } });
        if (!routing) throw new Error(`Routing ${routingId} no existe`);

        const company = await this.companyRepo.findOne({ where: { id: companyId } });
        if (!company) throw new Error(`Empresa ${companyId} no encontrada`);

        const existing = await this.sessionRepo.findOne({ where: { companyId, routingId } });
        if (existing) {
            this.killRuntime(existing.id);
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

        const duplicate = await this.sessionRepo.findOne({ where: { companyId, routingId } });
        if (duplicate && duplicate.id !== sessionId) {
            this.killRuntime(duplicate.id);
            await this.sessionRepo.remove(duplicate);
        }

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

    async linkSession(companyId: string, sessionId: string): Promise<{ linking: boolean }> {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId, companyId } });
        if (!session) throw new Error(`Sesión ${sessionId} no encontrada`);

        if (this.runtimes.has(sessionId)) {
            this.logger.log(`Sesión ${sessionId} ya tiene socket activo`);
            return { linking: false };
        }

        this.logger.log(`Iniciando vinculación de sesión ${sessionId}...`);
        this.openSocket(session).catch((err) =>
            this.logger.error(`Error al vincular sesión ${sessionId}:`, err),
        );

        return { linking: true };
    }

    getQrStatus(sessionId: string): {
        qr: string | null;
        status: 'waiting_qr' | 'connected' | 'idle' | 'disconnected';
    } {
        const rt = this.runtimes.get(sessionId);
        if (!rt) {
            // sin runtime: consultar último estado conocido no es posible aquí,
            // pero podemos distinguir idle vs disconnected si el caller lo necesita
            return { qr: null, status: 'disconnected' };
        }
        if (rt.qr) return { qr: rt.qr, status: 'waiting_qr' };
        return { qr: null, status: 'connected' };
    }

    // ─── Socket interno ───────────────────────────────────────────────────────

    private async openSocket(session: WhatsappSession, retryCount = 0): Promise<void> {
        const { state, saveCreds } = await useDatabaseAuthState(session, this.sessionRepo);
        const { version } = await fetchLatestBaileysVersion();

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

        const rt: SessionRuntime = {
            sessionId: session.id,
            socket,
            qr: null,
            isOpen: false,
            sendQueue: Promise.resolve(),
            lastSentAt: 0,
            disconnectTimer: null,
            intentionalClose: false,
        };
        this.runtimes.set(session.id, rt);

        socket.ev.on('creds.update', () => saveCreds());

        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                rt.qr = qr;
                this.logger.log(`[${session.id}] QR generado ✅`);
            }

            if (connection === 'open') {
                rt.qr = null;
                rt.isOpen = true;   // ← agregado
                retryCount = 0;
                const phone = socket.user?.id?.split(':')[0] ?? 'desconocido';
                this.logger.log(`[${session.id}] Conectado como ${phone} ✅`);
                await this.sessionRepo.update(session.id, { status: 'CONNECTED', phoneNumber: phone });
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const loggedOut = statusCode === DisconnectReason.loggedOut;
                const restartRequired = statusCode === DisconnectReason.restartRequired;
                const conflict = statusCode === 401;

                // leer flag ANTES de borrar el runtime del Map
                const wasIntentional = rt.intentionalClose;

                this.runtimes.delete(session.id);
                this.linkingPromises.delete(session.id);

                if (wasIntentional) {
                    // Cierre por timer de inactividad: tiene creds, puede reconectar → IDLE
                    this.logger.log(`[${session.id}] Cierre intencional (inactividad). Marcando IDLE 💤`);
                    await this.sessionRepo.update(session.id, { status: 'IDLE' });
                    return;
                }

                if (loggedOut) {
                    this.logger.warn(`[${session.id}] Logout real. Limpiando credenciales...`);
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

                } else if (conflict) {
                    // 401: sesión reemplazada manualmente desde el móvil → DISCONNECTED real
                    this.logger.warn(`[${session.id}] Conflicto de sesión (401). Marcando DISCONNECTED.`);
                    await this.sessionRepo.update(session.id, { status: 'DISCONNECTED' });

                } else if (restartRequired) {
                    this.logger.warn(`[${session.id}] Restart requerido. Reconectando en 3s...`);
                    const freshSession = await this.sessionRepo.findOne({ where: { id: session.id } });
                    if (freshSession) setTimeout(() => this.openSocket(freshSession, 0), 3_000);

                } else {
                    // Cierre inesperado: backoff exponencial 3s → 6s → 12s → 24s → máx 60s
                    const delay = Math.min(3_000 * Math.pow(2, retryCount), 60_000);
                    this.logger.warn(
                        `[${session.id}] Cierre inesperado (código ${statusCode}). ` +
                        `Reconectando en ${delay / 1000}s (intento ${retryCount + 1})...`,
                    );
                    const freshSession = await this.sessionRepo.findOne({ where: { id: session.id } });
                    setTimeout(
                        () => this.openSocket(freshSession ?? session, retryCount + 1),
                        delay,
                    );
                }
            }
        });
    }

    // ─── Resolución de sesión ─────────────────────────────────────────────────

    private async resolveSession(
        companyId: string,
        purpose: MessagePurpose,
    ): Promise<SessionRuntime> {

        const candidates: MessagePurpose[] = purpose === 'ALL'
            ? ['ALL']
            : [purpose, 'ALL'];

        for (const candidate of candidates) {
            const session = await this.sessionRepo.findOne({
                where: { companyId, routing: { purpose: candidate } },
                relations: ['routing'],
            });

            if (!session) continue;

            // Caso 1: runtime activo en memoria
            const rt = this.runtimes.get(session.id);
            if (rt) return rt;

            // Caso 2: sin runtime pero tiene creds y está CONNECTED o IDLE → lazy reconnect
            if (session.creds && (session.status === 'CONNECTED' || session.status === 'IDLE')) {
                this.logger.log(`[${session.id}] Lazy reconnect para ${candidate} (estado: ${session.status})...`);
                const openedRt = await this.lazyConnect(session);
                if (openedRt) return openedRt;
            }

            // Caso 3: DISCONNECTED o BANNED o sin creds → probar siguiente candidato
        }

        throw new Error(
            `No hay sesión disponible para empresa ${companyId} con purpose ${purpose}`,
        );
    }

    private async lazyConnect(session: WhatsappSession): Promise<SessionRuntime | null> {
        if (this.linkingPromises.has(session.id)) {
            await this.linkingPromises.get(session.id);
            return this.runtimes.get(session.id) ?? null;
        }

        const connectPromise = new Promise<void>((resolve, reject) => {
            this.openSocket(session).catch(reject);

            const interval = setInterval(() => {
                const rt = this.runtimes.get(session.id);

                if (!rt) return; // todavía no se creó el runtime, seguir esperando

                if (rt.isOpen) {
                    clearInterval(interval);
                    resolve();
                    return;
                }

                if (rt.qr) {
                    // requiere escaneo manual, no podemos esperar indefinidamente
                    clearInterval(interval);
                    reject(new Error(`Sesión ${session.id} requiere QR, no se puede lazy-reconnect`));
                    return;
                }
            }, 300);

            setTimeout(() => {
                clearInterval(interval);
                reject(new Error(`Lazy connect timeout para sesión ${session.id}`));
            }, LAZY_CONNECT_TIMEOUT_MS);
        });

        this.linkingPromises.set(session.id, connectPromise.then(() => { }).catch(() => { }));

        try {
            await connectPromise;
            return this.runtimes.get(session.id) ?? null;
        } catch (err) {
            this.logger.warn(`Lazy connect falló para sesión ${session.id}: ${err}`);
            return null;
        } finally {
            this.linkingPromises.delete(session.id);
        }
    }

    private killRuntime(sessionId: string): void {
        const rt = this.runtimes.get(sessionId);
        if (!rt) return;
        this.clearTimer(rt);
        rt.intentionalClose = true;
        try { rt.socket.end(undefined); } catch (_) { }
        this.runtimes.delete(sessionId);
        this.linkingPromises.delete(sessionId);
        this.logger.log(`Runtime de sesión ${sessionId} destruido`);
    }

    // ─── Envíos públicos ──────────────────────────────────────────────────────

    async sendText(
        companyId: string,
        purpose: MessagePurpose,
        to: string,
        text: string,
    ) {
        const rt = await this.resolveSession(companyId, purpose);
        return this.enqueue(rt, (socket) =>
            socket.sendMessage(toJid(to), { text }),
        );
    }

    async sendImage(
        companyId: string,
        purpose: MessagePurpose,
        to: string,
        imageBuffer: Buffer,
        caption?: string,
    ) {
        const rt = await this.resolveSession(companyId, purpose);
        return this.enqueue(rt, (socket) =>
            socket.sendMessage(toJid(to), { image: imageBuffer, caption }),
        );
    }

    async sendDocument(
        companyId: string,
        purpose: MessagePurpose,
        to: string,
        fileBuffer: Buffer,
        fileName: string,
        mimetype: string,
        caption?: string,
    ) {
        const rt = await this.resolveSession(companyId, purpose);
        return this.enqueue(rt, (socket) =>
            socket.sendMessage(toJid(to), { document: fileBuffer, fileName, mimetype, caption }),
        );
    }

    // ─── Cola con delay por sesión ────────────────────────────────────────────

    private enqueue<T>(rt: SessionRuntime, task: (socket: WASocket) => Promise<T>): Promise<T> {
        const result = rt.sendQueue.then(async () => {
            const elapsed = Date.now() - rt.lastSentAt;
            if (rt.lastSentAt > 0 && elapsed < SEND_DELAY_MAX_MS) {
                await randomDelay(SEND_DELAY_MIN_MS, SEND_DELAY_MAX_MS);
            }
            return withTimeout(
                task(rt.socket),
                12_000,
                'Timeout: WhatsApp tardó demasiado',
            );
        });

        rt.sendQueue = result.then(
            async () => {
                rt.lastSentAt = Date.now();
                this.scheduleDisconnect(rt.sessionId);
                await this.touchSession(rt.sessionId).catch(
                    (err) => this.logger.warn(`touchSession falló: ${err}`),
                );
            },
            () => { rt.lastSentAt = Date.now(); },
        );

        return result;
    }

    // ─── Disconnect timer ─────────────────────────────────────────────────────

    private scheduleDisconnect(sessionId: string): void {
        const rt = this.runtimes.get(sessionId);
        if (!rt) return;
        this.clearTimer(rt);
        rt.disconnectTimer = setTimeout(async () => {
            this.logger.log(`Sesión ${sessionId} sin actividad. Cerrando socket 💤`);
            rt.intentionalClose = true;
            rt.socket.end(undefined);
            this.runtimes.delete(sessionId);
            // No actualizamos DB aquí: el handler connection.update lo hará
            // cuando llegue el evento 'close' con wasIntentional = true → IDLE
        }, POST_SEND_DISCONNECT_MS);
    }

    private clearTimer(rt: SessionRuntime): void {
        if (rt.disconnectTimer) {
            clearTimeout(rt.disconnectTimer);
            rt.disconnectTimer = null;
        }
    }

    // ─── Limpieza de sesiones inactivas (llamado desde scheduler) ─────────────

    /** Domingo 11pm - Paso 1: sesiones sin uso en 7 días → limpiar keys */
    async cleanInactiveKeys(): Promise<void> {
        const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const result = await this.sessionRepo
            .createQueryBuilder()
            .update()
            .set({ keys: () => 'NULL' })
            .where('status NOT IN (:...excluded)', { excluded: ['BANNED', 'DISCONNECTED'] })
            .andWhere('(lastUsedAt IS NULL OR lastUsedAt < :threshold)', { threshold })
            .andWhere('keys IS NOT NULL')
            .execute();

        this.logger.log(`cleanInactiveKeys: ${result.affected} sesiones limpiadas ✅`);
    }

    /** Domingo 11pm - Paso 2: sesiones sin uso en 30 días → limpiar creds + DISCONNECTED */
    async cleanStaleCredentials(): Promise<void> {
        const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await this.sessionRepo
            .createQueryBuilder()
            .update()
            .set({ creds: () => 'NULL', keys: () => 'NULL', status: 'DISCONNECTED', phoneNumber: () => 'NULL' })
            .where('status NOT IN (:...excluded)', { excluded: ['BANNED', 'DISCONNECTED'] })
            .andWhere('(lastUsedAt IS NULL OR lastUsedAt < :threshold)', { threshold })
            .andWhere('creds IS NOT NULL')
            .execute();

        this.logger.log(`cleanStaleCredentials: ${result.affected} sesiones purgadas ✅`);
    }

    // ─── Actualizar lastUsedAt ─────────────────────────────────────────────────

    private async touchSession(sessionId: string): Promise<void> {
        await this.sessionRepo.update(sessionId, { lastUsedAt: new Date() });
    }
}