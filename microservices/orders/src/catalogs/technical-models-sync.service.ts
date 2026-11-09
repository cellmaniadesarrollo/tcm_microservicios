import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Model } from './entities/model.entity';
import { ModelTechnicalCode } from './entities/model-technical-code.entity';

interface TechnicalModelItem {
    numericId?: number; // informativo, no se usa para enlazar
    sourceId: string;
    name?: string;
    technicalModels: string[];
}

interface SyncPage {
    items: TechnicalModelItem[];
    nextCursor: number;
    hasMore: boolean;
}

interface BatchResult {
    received: number;   // dispositivos recibidos
    matched: number;    // dispositivos que existen en models (por slug)
    attempted: number;  // códigos que se intentaron insertar
    inserted: number;   // códigos realmente nuevos
    skipped: number;    // dispositivos sin modelo en Nest
    missing: string[];  // sourceId sin coincidencia
}

@Injectable()
export class TechnicalModelsSyncService {
    private readonly logger = new Logger(TechnicalModelsSyncService.name);
    private readonly PAGE_SIZE = 500;
    private readonly INSERT_CHUNK = 2000;
    private running = false;

    constructor(
        @Inject('SCRAPER_RPC') private readonly client: ClientProxy,
        @InjectRepository(Model) private readonly modelRepo: Repository<Model>,
        @InjectRepository(ModelTechnicalCode)
        private readonly codeRepo: Repository<ModelTechnicalCode>,
    ) { }

    /** Evita ejecuciones simultáneas y nunca lanza excepciones. */
    async runSafe() {
        if (this.running) return;
        this.running = true;
        try {
            await this.syncAll();
        } catch (err: any) {
            this.logger.error(`❌ Sync de modelos técnicos falló: ${err?.message ?? err}`);
        } finally {
            this.running = false;
        }
    }

    /** Pide páginas al scraper hasta que hasMore sea false. Es idempotente. */
    async syncAll(): Promise<void> {
        let after = 0;
        let hasMore = true;
        const total = { received: 0, matched: 0, attempted: 0, inserted: 0, skipped: 0 };
        const missingSample: string[] = [];

        while (hasMore) {
            const page = await firstValueFrom(
                this.client
                    .send<SyncPage>(
                        { cmd: 'sync_technical_models' },
                        {
                            internalToken: process.env.INTERNAL_SECRET,
                            after,
                            limit: this.PAGE_SIZE,
                        },
                    )
                    .pipe(timeout(30_000)),
            );

            this.logger.log(
                `📥 Página recibida: ${page.items.length} items (after=${after}, hasMore=${page.hasMore})`,
            );

            const r = await this.saveBatch(page.items);
            total.received += r.received;
            total.matched += r.matched;
            total.attempted += r.attempted;
            total.inserted += r.inserted;
            total.skipped += r.skipped;
            for (const id of r.missing) {
                if (missingSample.length < 20) missingSample.push(id);
            }

            // protección contra bucle infinito si el cursor no avanza
            if (page.hasMore && page.nextCursor <= after) {
                this.logger.warn('El cursor no avanzó, se corta el sync');
                break;
            }
            after = page.nextCursor;
            hasMore = page.hasMore;
        }

        this.logger.log(
            `✅ Modelos técnicos | dispositivos recibidos: ${total.received} | con modelo en Nest: ${total.matched} | ` +
            `códigos nuevos: ${total.inserted} (intentados: ${total.attempted}) | sin modelo en Nest: ${total.skipped}`,
        );
        if (missingSample.length) {
            this.logger.warn(`Ejemplos sin modelo en Nest: ${missingSample.join(', ')}`);
        }
    }

    async saveBatch(items: TechnicalModelItem[]): Promise<BatchResult> {
        const empty: BatchResult = {
            received: 0, matched: 0, attempted: 0, inserted: 0, skipped: 0, missing: [],
        };
        if (!items?.length) return empty;

        const key = (s: string) => s.slice(0, 100);
        const findIds = [...new Set(items.map((i) => i.sourceId).filter(Boolean).map(key))];
        if (!findIds.length) return { ...empty, received: items.length, skipped: items.length };

        // Enlace SOLO por slug. El numericId del scraper no es models_id.
        const models = await this.modelRepo.find({
            select: ['models_id', 'models_find_id'],
            where: { models_find_id: In(findIds) },
        });
        const idByFindId = new Map(models.map((m) => [m.models_find_id, m.models_id]));

        const rows: { mtc_models_id: number; mtc_code: string }[] = [];
        const missing: string[] = [];
        let matched = 0;

        for (const item of items) {
            const modelsId = item.sourceId ? idByFindId.get(key(item.sourceId)) : undefined;
            if (!modelsId) {
                missing.push(item.sourceId);
                continue;
            }
            matched++;
            const codes = new Set(
                (item.technicalModels ?? []).map((c) => c.trim()).filter(Boolean),
            );
            for (const code of codes) {
                rows.push({ mtc_models_id: modelsId, mtc_code: code.slice(0, 100) });
            }
        }

        let inserted = 0;
        for (let i = 0; i < rows.length; i += this.INSERT_CHUNK) {
            const res = await this.codeRepo
                .createQueryBuilder()
                .insert()
                .into(ModelTechnicalCode)
                .values(rows.slice(i, i + this.INSERT_CHUNK))
                .orIgnore() // ON CONFLICT DO NOTHING (por el UNIQUE)
                .execute();
            // Con DO NOTHING + RETURNING, solo vuelven las filas realmente insertadas
            inserted += Array.isArray(res.raw) ? res.raw.length : 0;
        }

        return {
            received: items.length,
            matched,
            attempted: rows.length,
            inserted,
            skipped: missing.length,
            missing,
        };
    }
}