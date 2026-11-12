import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductReplica } from './entities/product-replica.entity';
import { ProductSnapshot } from './types/product-snapshot';

const CHUNK = 500; // 23 columnas × 500 filas < 65 535 parámetros

// Columnas (nombre en BD) que se sobrescriben en el conflicto
const UPDATE_COLUMNS = [
    'company_id', 'code', 'sku', 'upc', 'name', 'description', 'kind', 'tracking_mode',
    'product_type_id', 'product_type_code', 'product_type_name',
    'color_id', 'color_name', 'quality_id', 'quality_name',
    'model_ids', 'status', 'defaults', 'created_at', 'updated_at',
];

@Injectable()
export class ProductsReplicaService {
    private readonly logger = new Logger(ProductsReplicaService.name);

    constructor(
        @InjectRepository(ProductReplica)
        private readonly repo: Repository<ProductReplica>,
    ) { }

    /**
     * Upsert idempotente. Solo pisa una fila si el evento NO es más viejo que lo guardado
     * (`updated_at <= EXCLUDED.updated_at`). Con `<=` un reenvío del mismo estado vuelve a aplicarse
     * (corrige nombres de catálogo cambiados sin que cambie updatedAt).
     * Devuelve cuántas filas distintas se procesaron.
     */
    async upsertMany(items: ProductSnapshot[]): Promise<number> {
        // Postgres falla si el mismo id aparece dos veces en un mismo INSERT ... ON CONFLICT: se deduplica
        const byId = new Map<string, ProductSnapshot>();
        for (const it of items ?? []) {
            if (!it?.id || !it.companyId || !it.updatedAt || !it.sku) {
                this.logger.warn(`Snapshot inválido ignorado: ${it?.id ?? 'sin id'}`);
                continue;
            }
            const prev = byId.get(it.id);
            if (!prev || prev.updatedAt <= it.updatedAt) byId.set(it.id, it);
        }
        const list = [...byId.values()];
        if (!list.length) return 0;

        const setClause = [
            ...UPDATE_COLUMNS.map((c) => `"${c}" = EXCLUDED."${c}"`),
            `"synced_at" = now()`,
        ].join(', ');

        for (let i = 0; i < list.length; i += CHUNK) {
            const rows = list.slice(i, i + CHUNK).map((s) => ({
                id: s.id,
                companyId: s.companyId,
                code: s.code,
                sku: s.sku,
                upc: s.upc ?? null,
                name: s.name,
                description: s.description ?? null,
                kind: s.kind,
                trackingMode: s.trackingMode,
                productTypeId: s.productTypeId,
                productTypeCode: s.productTypeCode,
                productTypeName: s.productTypeName,
                colorId: s.colorId ?? null,
                colorName: s.colorName ?? null,
                qualityId: s.qualityId ?? null,
                qualityName: s.qualityName ?? null,
                modelIds: s.modelIds ?? [],
                status: s.status,
                defaults: s.defaults ?? {},
                createdAt: new Date(s.createdAt),
                updatedAt: new Date(s.updatedAt),
            }));

            await this.repo
                .createQueryBuilder()
                .insert()
                .into(ProductReplica)
                .values(rows)
                .onConflict(
                    `("id") DO UPDATE SET ${setClause} WHERE "products_replica"."updated_at" <= EXCLUDED."updated_at"`,
                )
                .execute();
        }
        return list.length;
    }

    /** Mayor updated_at guardado, o null si la tabla está vacía (es lo que dispara el sync completo). */
    async getLastUpdatedAt(): Promise<Date | null> {
        const row = await this.repo
            .createQueryBuilder('p')
            .select('MAX(p.updated_at)', 'max')
            .getRawOne<{ max: Date | null }>();
        return row?.max ?? null;
    }
}