import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Brand } from './entities/brand.entity';
import { Model } from './entities/model.entity';
import { TechnicalModelsSyncService } from './technical-models-sync.service';

interface ModelItem {
    numericId: number;
    sourceId: string;
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

@Injectable()
export class ModelsSyncService {
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
        let newBrands = 0;
        let newModels = 0;
        let existing = 0;

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
            newBrands += r.newBrands;
            newModels += r.newModels;
            existing += r.existing;

            if (page.hasMore && page.nextCursor <= after) {
                this.logger.warn('El cursor no avanzó, se corta el sync');
                break;
            }
            after = page.nextCursor;
            hasMore = page.hasMore;
        }

        this.logger.log(
            `✅ Modelos sincronizados | marcas nuevas: ${newBrands} | modelos nuevos: ${newModels} | ya existían: ${existing}`,
        );
    }

    private async saveBatch(items: ModelItem[]) {
        if (!items?.length) return { newBrands: 0, newModels: 0, existing: 0 };

        /** 1️⃣ Marcas: resolver cuáles existen y crear las que faltan */
        const incomingBrands = new Map<number, ModelItem['brand']>();
        for (const i of items) incomingBrands.set(i.brand.id, i.brand);

        const brandList = [...incomingBrands.values()];
        const existingBrands = await this.brandRepo.find({
            where: [
                { brands_id: In(brandList.map((b) => b.id)) },
                { brands_find_id: In(brandList.map((b) => b.sourceId)) },
            ],
        });
        const brandIdById = new Map(existingBrands.map((b) => [b.brands_id, b.brands_id]));
        const brandIdByFindId = new Map(existingBrands.map((b) => [b.brands_find_id, b.brands_id]));

        const brandsToInsert = brandList.filter(
            (b) => !brandIdById.has(b.id) && !brandIdByFindId.has(b.sourceId),
        );
        if (brandsToInsert.length) {
            await this.brandRepo
                .createQueryBuilder()
                .insert()
                .into(Brand)
                .values(
                    brandsToInsert.map((b) => ({
                        brands_id: b.id,
                        brands_find_id: b.sourceId.slice(0, 50),
                        brands_name: b.name.slice(0, 255),
                        brands_devices_count: 0,
                        brands_laptops_count: 0,
                    })),
                )
                .orIgnore()
                .execute();
            for (const b of brandsToInsert) {
                brandIdById.set(b.id, b.id);
                brandIdByFindId.set(b.sourceId, b.id);
            }
        }
        const resolveBrandId = (b: ModelItem['brand']) =>
            brandIdByFindId.get(b.sourceId) ?? brandIdById.get(b.id);

        /** 2️⃣ Modelos: solo los que no existen (por id o por find_id) */
        const existingModels = await this.modelRepo.find({
            select: ['models_id', 'models_find_id'],
            where: [
                { models_id: In(items.map((i) => i.numericId)) },
                { models_find_id: In(items.map((i) => i.sourceId)) },
            ],
        });
        const knownIds = new Set(existingModels.map((m) => m.models_id));
        const knownFindIds = new Set(existingModels.map((m) => m.models_find_id));

        const rows: Partial<Model>[] = [];
        let existing = 0;

        for (const i of items) {
            if (knownIds.has(i.numericId) || knownFindIds.has(i.sourceId)) {
                existing++;
                continue;
            }
            const brandId = resolveBrandId(i.brand);
            if (!brandId) continue;

            rows.push({
                models_id: i.numericId,
                models_find_id: i.sourceId.slice(0, 100),
                models_name: i.name.slice(0, 255),
                models_brands_id: brandId,
                models_img_url: i.imgUrl && i.imgUrl.length <= 500 ? i.imgUrl : undefined,
                models_description: i.description || undefined,
            });
        }

        if (rows.length) {
            await this.modelRepo
                .createQueryBuilder()
                .insert()
                .into(Model)
                .values(rows)
                .orIgnore() // ON CONFLICT DO NOTHING
                .execute();
        }

        return { newBrands: brandsToInsert.length, newModels: rows.length, existing };
    }
}