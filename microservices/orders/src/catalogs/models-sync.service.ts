import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Brand } from './entities/brand.entity';
import { Model } from './entities/model.entity';
import { TechnicalModelsSyncService } from './technical-models-sync.service';

interface ModelItem {
    numericId: number; // id de GSMArena: solo informativo, NO es models_id
    sourceId: string;  // slug: es la clave de enlace con el scraper
    name: string;
    imgUrl?: string;
    description?: string;
    brand: { id: number; sourceId: string; name: string };
}

interface ModelsPage {
    items: ModelItem[];
    nextCursor: number;
    hasMore: boolean;
}

export interface ModelsBatchResult {
    newBrands: number;
    newModels: number;
    existing: number;
    skippedNoBrand: number;
}

@Injectable()
export class ModelsSyncService implements OnModuleInit {
    private readonly logger = new Logger(ModelsSyncService.name);
    private readonly PAGE_SIZE = 500;
    private running = false;

    constructor(
        @Inject('SCRAPER_RPC') private readonly client: ClientProxy,
        @InjectRepository(Brand) private readonly brandRepo: Repository<Brand>,
        @InjectRepository(Model) private readonly modelRepo: Repository<Model>,
        private readonly technicalSync: TechnicalModelsSyncService,
    ) { }

    onModuleInit() {
        void this.runSafe();
    }

    /** Red de seguridad diaria por si se perdieron eventos de Kafka. */
    @Cron('0 3 * * *')
    handleCron() {
        void this.runSafe();
    }

    /** Primero modelos faltantes, luego códigos técnicos (dependen de los modelos). */
    private async runSafe() {
        if (this.running) return;
        this.running = true;
        try {
            await this.syncAll();
        } catch (err: any) {
            this.logger.error(`❌ Sync de modelos falló: ${err?.message ?? err}`);
        } finally {
            this.running = false;
        }
        await this.technicalSync.runSafe();
    }

    async syncAll(): Promise<void> {
        let after = 0;
        let hasMore = true;
        const total = { newBrands: 0, newModels: 0, existing: 0, skippedNoBrand: 0 };

        while (hasMore) {
            const page = await firstValueFrom(
                this.client
                    .send<ModelsPage>(
                        { cmd: 'sync_models' },
                        { internalToken: process.env.INTERNAL_SECRET, after, limit: this.PAGE_SIZE },
                    )
                    .pipe(timeout(30_000)),
            );

            this.logger.log(`📥 Página: ${page.items.length} items (after=${after}, hasMore=${page.hasMore})`);

            const r = await this.saveBatch(page.items);
            total.newBrands += r.newBrands;
            total.newModels += r.newModels;
            total.existing += r.existing;
            total.skippedNoBrand += r.skippedNoBrand;

            if (page.hasMore && page.nextCursor <= after) {
                this.logger.warn('El cursor no avanzó, se corta el sync');
                break;
            }
            after = page.nextCursor;
            hasMore = page.hasMore;
        }

        this.logger.log(
            `✅ Modelos sincronizados | marcas nuevas: ${total.newBrands} | modelos nuevos: ${total.newModels} | ` +
            `ya existían: ${total.existing} | sin marca: ${total.skippedNoBrand}`,
        );
    }

    /**
     * Enlaza SOLO por slug (find_id). Los ids de Postgres los genera la base:
     * el numericId del scraper nunca se usa como models_id ni brands_id.
     */
    async saveBatch(items: ModelItem[]): Promise<ModelsBatchResult> {
        const empty: ModelsBatchResult = { newBrands: 0, newModels: 0, existing: 0, skippedNoBrand: 0 };
        if (!items?.length) return empty;

        const brandKey = (s: string) => s.slice(0, 50);
        const modelKey = (s: string) => s.slice(0, 100);

        /** 1️⃣ Marcas */
        const incomingBrands = new Map<string, ModelItem['brand']>();
        for (const i of items) incomingBrands.set(brandKey(i.brand.sourceId), i.brand);

        const brandKeys = [...incomingBrands.keys()];
        const existingBrands = await this.brandRepo.find({
            where: { brands_find_id: In(brandKeys) },
        });
        const brandIdByFindId = new Map<string, number>(
            existingBrands.map((b) => [b.brands_find_id, b.brands_id]),
        );

        const brandsToInsert = [...incomingBrands.entries()].filter(([k]) => !brandIdByFindId.has(k));
        let newBrands = 0;
        if (brandsToInsert.length) {
            await this.brandRepo
                .createQueryBuilder()
                .insert()
                .into(Brand)
                .values(
                    brandsToInsert.map(([k, b]) => ({
                        // sin brands_id: lo genera Postgres
                        brands_find_id: k,
                        brands_name: b.name.slice(0, 255),
                        brands_devices_count: 0,
                        brands_laptops_count: 0,
                    })),
                )
                .orIgnore()
                .execute();

            const created = await this.brandRepo.find({
                where: { brands_find_id: In(brandsToInsert.map(([k]) => k)) },
            });
            for (const b of created) brandIdByFindId.set(b.brands_find_id, b.brands_id);
            newBrands = created.length;
        }

        /** 2️⃣ Modelos: solo por find_id */
        const uniqueItems = new Map<string, ModelItem>();
        for (const i of items) uniqueItems.set(modelKey(i.sourceId), i);

        const existingModels = await this.modelRepo.find({
            select: ['models_id', 'models_find_id'],
            where: { models_find_id: In([...uniqueItems.keys()]) },
        });
        const knownFindIds = new Set(existingModels.map((m) => m.models_find_id));

        const rows: Partial<Model>[] = [];
        let existing = 0;
        let skippedNoBrand = 0;

        for (const [key, i] of uniqueItems) {
            if (knownFindIds.has(key)) {
                existing++;
                continue;
            }
            const brandId = brandIdByFindId.get(brandKey(i.brand.sourceId));
            if (!brandId) {
                skippedNoBrand++;
                this.logger.warn(`Sin marca resuelta para ${i.sourceId} (${i.brand.sourceId})`);
                continue;
            }

            rows.push({
                // sin models_id: lo genera Postgres
                models_find_id: key,
                models_name: i.name.slice(0, 255),
                models_brands_id: brandId,
                models_img_url: i.imgUrl && i.imgUrl.length <= 500 ? i.imgUrl : undefined,
                models_description: i.description || undefined,
            });
        }

        let newModels = 0;
        if (rows.length) {
            const res = await this.modelRepo
                .createQueryBuilder()
                .insert()
                .into(Model)
                .values(rows)
                .orIgnore() // ON CONFLICT DO NOTHING
                .execute();
            // con DO NOTHING solo vuelven las filas realmente insertadas
            newModels = Array.isArray(res.raw) ? res.raw.length : rows.length;
        }

        return { newBrands, newModels, existing, skippedNoBrand };
    }
}