import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { LotsReplicaService, LotSnapshot } from './lots-replica.service';

const PAGE_SIZE = 500;
const OVERLAP_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const STARTUP_MAX_ATTEMPTS = 8;
const LOCK_KEY = 730_300_1;

type Mode = 'startup' | 'full';

@Injectable()
export class LotsSyncService implements OnApplicationBootstrap {
    private readonly logger = new Logger(LotsSyncService.name);

    constructor(
        @Inject('INVENTORY_SYNC') private readonly client: ClientProxy,
        private readonly replica: LotsReplicaService,
        private readonly dataSource: DataSource,
    ) { }

    onApplicationBootstrap() { void this.startupWithRetry(); }

    @Cron('15 3 * * *', { timeZone: 'America/Guayaquil' })
    async dailyReconciliation() {
        try { await this.run('full'); }
        catch (e: any) { this.logger.error(`Reconciliación diaria de lotes fallida: ${e?.message}`); }
    }

    private async startupWithRetry() {
        for (let attempt = 1; attempt <= STARTUP_MAX_ATTEMPTS; attempt++) {
            try { await this.run('startup'); return; }
            catch (e: any) {
                const delay = Math.min(5000 * attempt, 60_000);
                this.logger.warn(`Sync inicial de lotes falló (${attempt}/${STARTUP_MAX_ATTEMPTS}): ${e?.message}. Reintento en ${delay} ms`);
                await new Promise((r) => setTimeout(r, delay));
            }
        }
        this.logger.error('Sync inicial de lotes agotó los reintentos; la reconciliación diaria lo recuperará');
    }

    async run(mode: Mode): Promise<void> {
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        try {
            const [{ locked }] = await qr.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY]);
            if (!locked) { this.logger.log(`Sync de lotes (${mode}) omitido: ya hay otro en curso`); return; }
            try { await this.pullAll(mode); }
            finally { await qr.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]); }
        } finally { await qr.release(); }
    }

    private async pullAll(mode: Mode) {
        let createdSince: string | null = null;
        if (mode === 'startup') {
            const last = await this.replica.getLastCreatedAt();
            if (last) createdSince = new Date(new Date(last).getTime() - OVERLAP_MS).toISOString();
        }

        const started = Date.now();
        let cursor: string | null = null;
        let pages = 0;
        let total = 0;
        do {
            const res: { items: LotSnapshot[]; nextCursor: string | null } = await firstValueFrom(
                this.client.send(
                    { cmd: 'get_lots_sync' },
                    { internalToken: process.env.INTERNAL_SECRET, cursor, createdSince, limit: PAGE_SIZE },
                ).pipe(timeout(REQUEST_TIMEOUT_MS)),
            );
            total += await this.replica.upsertMany(res.items ?? []);
            cursor = res.nextCursor ?? null;
            pages++;
        } while (cursor);

        this.logger.log(`✅ Sync de lotes (${mode}${createdSince ? ` desde ${createdSince}` : ', completo'}): ${total} filas en ${pages} página(s), ${Date.now() - started} ms`);
    }
}