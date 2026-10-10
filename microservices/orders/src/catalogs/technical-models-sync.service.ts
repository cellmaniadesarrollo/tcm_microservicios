import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Model } from './entities/model.entity';
import { ModelTechnicalCode } from './entities/model-technical-code.entity';

interface TechnicalModelItem {
    numericId: number;
    sourceId: string;
    name: string;
    technicalModels: string[];
}

interface SyncPage {
    items: TechnicalModelItem[];
    nextCursor: number;
    hasMore: boolean;
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

    /**
     * Punto de entrada seguro: evita ejecuciones simultáneas y nunca lanza
     * excepciones (si el scraper está caído, solo queda el error en el log).
     * Lo invoca ModelsSyncService al arrancar, después de sincronizar los modelos.
     */
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
        let saved = 0;
        let skipped = 0;

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

            const result = await this.saveBatch(page.items);
            saved += result.saved;
            skipped += result.skipped;

            // protección contra bucle infinito si el cursor no avanza
            if (page.hasMore && page.nextCursor <= after) {
                this.logger.warn('El cursor no avanzó, se corta el sync');
                break;
            }
            after = page.nextCursor;
            hasMore = page.hasMore;
        }

        this.logger.log(
            `✅ Modelos técnicos sincronizados | códigos: ${saved} | modelos no encontrados: ${skipped}`,
        );
    }

    private async saveBatch(items: TechnicalModelItem[]) {
        if (!items?.length) return { saved: 0, skipped: 0 };

        // sourceId (GSMArena) == models_find_id
        const models = await this.modelRepo.find({
            select: ['models_id', 'models_find_id'],
            where: { models_find_id: In(items.map((i) => i.sourceId)) },
        });
        const idByFindId = new Map(models.map((m) => [m.models_find_id, m.models_id]));

        const rows: { mtc_models_id: number; mtc_code: string }[] = [];
        const missing: string[] = [];

        for (const item of items) {
            const modelsId = idByFindId.get(item.sourceId);
            if (!modelsId) {
                missing.push(item.sourceId);
                continue;
            }
            const codes = new Set(
                (item.technicalModels ?? []).map((c) => c.trim()).filter(Boolean),
            );
            for (const code of codes) {
                rows.push({ mtc_models_id: modelsId, mtc_code: code.slice(0, 100) });
            }
        }

        if (missing.length) {
            this.logger.warn(
                `Sin coincidencia en models (${missing.length}): ${missing.slice(0, 10).join(', ')}`,
            );
        }

        for (let i = 0; i < rows.length; i += this.INSERT_CHUNK) {
            await this.codeRepo
                .createQueryBuilder()
                .insert()
                .into(ModelTechnicalCode)
                .values(rows.slice(i, i + this.INSERT_CHUNK))
                .orIgnore() // ON CONFLICT DO NOTHING (por el UNIQUE)
                .execute();
        }

        return { saved: rows.length, skipped: missing.length };
    }
}