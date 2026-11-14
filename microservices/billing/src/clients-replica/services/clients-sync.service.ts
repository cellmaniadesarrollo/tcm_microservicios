import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { CustomersReplicaService } from './customers-replica.service';
import { BillingReplicaService } from './billing-replica.service';

const PAGE_SIZE = 500;
const STARTUP_OVERLAP_MS = 24 * 60 * 60 * 1000;
const INCREMENTAL_WINDOW_MS = 60 * 60 * 1000;   // el cron de 15 min pide la última hora
const REQUEST_TIMEOUT_MS = 30_000;
const STARTUP_MAX_ATTEMPTS = 8;

type Mode = 'startup' | 'incremental' | 'full';

interface Kind {
    name: string;
    cmd: string;
    lock: number;
    lastUpdatedAt: () => Promise<Date | null>;
    upsert: (items: any[]) => Promise<number>;
}

@Injectable()
export class ClientsSyncService implements OnApplicationBootstrap {
    private readonly logger = new Logger(ClientsSyncService.name);
    private readonly kinds: Kind[];

    constructor(
        @Inject('CLIENTS_SYNC') private readonly client: ClientProxy,
        private readonly customers: CustomersReplicaService,
        private readonly billing: BillingReplicaService,
        private readonly dataSource: DataSource,
    ) {
        this.kinds = [
            {
                name: 'clientes', cmd: 'get_customers_sync', lock: 730_400_1,
                lastUpdatedAt: () => this.customers.getLastUpdatedAt(), upsert: (i) => this.customers.upsertMany(i)
            },
            {
                name: 'datos de facturación', cmd: 'get_billing_data_sync', lock: 730_500_1,
                lastUpdatedAt: () => this.billing.getLastUpdatedAt(), upsert: (i) => this.billing.upsertMany(i)
            },
        ];
    }

    onApplicationBootstrap() { void this.startupWithRetry(); }

    /** Cada 15 minutos: trae lo modificado en la última hora (cubre eventos perdidos recientes). */
    @Cron('*/15 * * * *', { timeZone: 'America/Guayaquil' })
    async incremental() { await this.runAll('incremental'); }

    /** Diario completo: red de seguridad total. */
    @Cron('30 3 * * *', { timeZone: 'America/Guayaquil' })
    async daily() { await this.runAll('full'); }

    private async runAll(mode: Mode) {
        for (const kind of this.kinds) {
            try { await this.run(kind, mode); }
            catch (e: any) { this.logger.error(`Sync ${mode} de ${kind.name} fallido: ${e?.message}`); }
        }
    }

    private async startupWithRetry() {
        for (const kind of this.kinds) {
            let done = false;
            for (let attempt = 1; attempt <= STARTUP_MAX_ATTEMPTS && !done; attempt++) {
                try { await this.run(kind, 'startup'); done = true; }
                catch (e: any) {
                    const delay = Math.min(5000 * attempt, 60_000);
                    this.logger.warn(`Sync inicial de ${kind.name} falló (${attempt}/${STARTUP_MAX_ATTEMPTS}): ${e?.message}. Reintento en ${delay} ms`);
                    await new Promise((r) => setTimeout(r, delay));
                }
            }
            if (!done) this.logger.error(`Sync inicial de ${kind.name} agotó los reintentos; el cron lo recuperará`);
        }
    }

    private async run(kind: Kind, mode: Mode) {
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        try {
            const [{ locked }] = await qr.query('SELECT pg_try_advisory_lock($1) AS locked', [kind.lock]);
            if (!locked) { this.logger.log(`Sync ${mode} de ${kind.name} omitido: ya hay otro en curso`); return; }
            try { await this.pullAll(kind, mode); }
            finally { await qr.query('SELECT pg_advisory_unlock($1)', [kind.lock]); }
        } finally { await qr.release(); }
    }

    private async pullAll(kind: Kind, mode: Mode) {
        let updatedSince: string | null = null;
        if (mode === 'incremental') {
            updatedSince = new Date(Date.now() - INCREMENTAL_WINDOW_MS).toISOString();
        } else if (mode === 'startup') {
            const last = await kind.lastUpdatedAt();
            if (last) updatedSince = new Date(new Date(last).getTime() - STARTUP_OVERLAP_MS).toISOString();
        }

        const started = Date.now();
        let cursor: string | null = null;
        let pages = 0;
        let total = 0;
        do {
            const res: { items: any[]; nextCursor: string | null } = await firstValueFrom(
                this.client.send(
                    { cmd: kind.cmd },
                    { internalToken: process.env.INTERNAL_SECRET, cursor, updatedSince, limit: PAGE_SIZE },
                ).pipe(timeout(REQUEST_TIMEOUT_MS)),
            );
            total += await kind.upsert(res.items ?? []);
            cursor = res.nextCursor ?? null;
            pages++;
        } while (cursor);

        // En incremental solo se loguea si hubo algo, para no llenar el log cada 15 min
        if (mode !== 'incremental' || total > 0) {
            this.logger.log(`✅ Sync ${mode} de ${kind.name}${updatedSince ? ` desde ${updatedSince}` : ' (completo)'}: ${total} filas en ${pages} página(s), ${Date.now() - started} ms`);
        }
    }
}