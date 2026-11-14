import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { ProductsReplicaService } from './products-replica.service';
import { ProductSnapshot } from './types/product-snapshot';

const PAGE_SIZE = 500;
const OVERLAP_MS = 24 * 60 * 60 * 1000;   // traslape al arrancar
const REQUEST_TIMEOUT_MS = 30_000;
const STARTUP_MAX_ATTEMPTS = 8;
const LOCK_KEY = 730_200_1;               // advisory lock: una sola instancia sincroniza a la vez

type Mode = 'startup' | 'full';

@Injectable()
export class ProductsSyncService implements OnApplicationBootstrap {
    private readonly logger = new Logger(ProductsSyncService.name);

    constructor(
        @Inject('INVENTORY_SYNC') private readonly client: ClientProxy,
        private readonly replica: ProductsReplicaService,
        private readonly dataSource: DataSource,
    ) { }

    /** En segundo plano: billing arranca aunque inventory-core esté caído. */
    onApplicationBootstrap() {
        void this.startupWithRetry();
    }

    /** Reconciliación completa diaria (detecta eventos perdidos, DLQ y nombres de catálogo cambiados). */
    @Cron('0 3 * * *', { timeZone: 'America/Guayaquil' })
    async dailyReconciliation() {
        try {
            await this.run('full');
        } catch (e: any) {
            this.logger.error(`Reconciliación diaria fallida: ${e?.message}`);
        }
    }

    private async startupWithRetry() {
        for (let attempt = 1; attempt <= STARTUP_MAX_ATTEMPTS; attempt++) {
            try {
                await this.run('startup');
                return;
            } catch (e: any) {
                const delay = Math.min(5000 * attempt, 60_000);
                this.logger.warn(`Sync inicial de productos falló (intento ${attempt}/${STARTUP_MAX_ATTEMPTS}): ${e?.message}. Reintento en ${delay} ms`);
                await new Promise((r) => setTimeout(r, delay));
            }
        }
        this.logger.error('Sync inicial de productos agotó los reintentos; la reconciliación diaria lo recuperará');
    }

    /** Lanza si falla. Si otra instancia ya está sincronizando, sale sin hacer nada. */
    async run(mode: Mode): Promise<void> {
        // El advisory lock es de sesión: hay que tomarlo y soltarlo en la MISMA conexión
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        try {
            const [{ locked }] = await qr.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY]);
            if (!locked) {
                this.logger.log(`Sync de productos (${mode}) omitido: ya hay otro en curso`);
                return;
            }
            try {
                await this.pullAll(mode);
            } finally {
                await qr.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
            }
        } finally {
            await qr.release();
        }
    }

    private async pullAll(mode: Mode) {
        let updatedSince: string | null = null;
        if (mode === 'startup') {
            const last = await this.replica.getLastUpdatedAt();
            // Tabla vacía => todo; si no, desde el último updated_at menos el traslape
            if (last) updatedSince = new Date(new Date(last).getTime() - OVERLAP_MS).toISOString();
        }

        const started = Date.now();
        let cursor: string | null = null;
        let pages = 0;
        let total = 0;

        do {
            const res: { items: ProductSnapshot[]; nextCursor: string | null } = await firstValueFrom(
                this.client
                    .send(
                        { cmd: 'get_products_sync' },
                        {
                            internalToken: process.env.INTERNAL_SECRET,
                            cursor,
                            updatedSince,
                            limit: PAGE_SIZE,
                        },
                    )
                    .pipe(timeout(REQUEST_TIMEOUT_MS)),
            );

            total += await this.replica.upsertMany(res.items ?? []);
            cursor = res.nextCursor ?? null;
            pages++;
        } while (cursor);

        this.logger.log(
            `✅ Sync de productos (${mode}${updatedSince ? ` desde ${updatedSince}` : ', completo'}): ` +
            `${total} filas en ${pages} página(s), ${Date.now() - started} ms`,
        );
    }
}