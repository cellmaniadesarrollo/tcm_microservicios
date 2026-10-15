import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ProductType } from '../product-catalogs/entities/product-type.entity';
import { Color } from '../product-catalogs/entities/color.entity';
import { Quality } from '../product-catalogs/entities/quality.entity';
import { Model } from '../devices-replica/entities/model.entity';
import { BillingMode, TrackingMode } from './enums/product.enums';
import { Product } from './entities/product.entity';
/** Prefijo del SKU según el kind del tipo. Ajusta a tu gusto. */
const KIND_PREFIX: Record<string, string> = {
    PART: 'REP',
    ACCESSORY: 'ACC',
    DEVICE: 'EQP',
};
@Injectable()
export class ProductsService {
    constructor(private readonly dataSource: DataSource) { }

    async create(dto: any, companyId: string) {
        return this.dataSource.transaction(async (em) => {
            // Serializa la creación por empresa para que el correlativo no se repita
            await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`products_code:${companyId}`]);

            // 1. Tipo (de aquí sale el kind)
            const type = await em.findOne(ProductType, {
                where: { id: dto.productTypeId, companyId, status: true },
            });
            if (!type) throw new BadRequestException('El tipo de producto no existe o está inactivo');

            // 2. Color y calidad (opcionales)
            if (dto.colorId) {
                const ok = await em.exists(Color, { where: { id: dto.colorId, companyId, status: true } });
                if (!ok) throw new BadRequestException('El color no existe o está inactivo');
            }
            if (dto.qualityId) {
                const ok = await em.exists(Quality, { where: { id: dto.qualityId, companyId, status: true } });
                if (!ok) throw new BadRequestException('La calidad no existe o está inactiva');
            }

            // 3. Modelos compatibles
            const modelIds: number[] = [...new Set<number>(dto.modelIds ?? [])];
            const models = modelIds.length
                ? await em.find(Model, { where: { models_id: In(modelIds) }, relations: { brand: true } })
                : [];
            if (models.length !== modelIds.length) {
                throw new BadRequestException('Alguno de los modelos indicados no existe');
            }

            // 4. Reglas por kind
            let trackingMode: TrackingMode = dto.trackingMode ?? TrackingMode.QUANTITY;
            if (type.kind === 'DEVICE') {
                if (modelIds.length !== 1) {
                    throw new BadRequestException('Un equipo completo debe tener exactamente un modelo');
                }
                trackingMode = TrackingMode.SERIAL; // lo exige el CHECK de la tabla
            }

            // 5. Correlativo por empresa y SKU
            const row = await em
                .createQueryBuilder(Product, 'p')
                .select('COALESCE(MAX(p.code), 0) + 1', 'next')
                .where('p.companyId = :companyId', { companyId })
                .getRawOne<{ next: string | number }>();

            const code = Number(row?.next ?? 1);

            const sku = [
                KIND_PREFIX[type.kind] ?? 'GEN',
                type.code,
                this.brandCode(models),
                String(code).padStart(6, '0'),
            ].join('-');

            // 6. Guardar (compatibleModels tiene cascade)
            try {
                const product = await em.save(
                    em.create(Product, {
                        companyId,
                        code,
                        sku,
                        upc: dto.upc || undefined,
                        name: dto.name.trim(),
                        description: dto.description,
                        imageUrl: dto.imageUrl,
                        kind: type.kind,
                        trackingMode,
                        productTypeId: type.id,
                        colorId: dto.colorId,
                        qualityId: dto.qualityId,
                        basePrice: String(dto.basePrice ?? 0),
                        hasTax: dto.hasTax ?? true,
                        billingMode: dto.billingMode ?? BillingMode.NO,
                        billableInRepairOrders: dto.billableInRepairOrders ?? false,
                        compatibleModels: modelIds.map((modelId) => ({ modelId })),
                    }),
                );
                return { id: product.id, code: product.code, sku: product.sku, name: product.name };
            } catch (error: any) {
                if (error.code === '23505') {
                    throw new ConflictException('Ya existe un producto con ese código de barras (UPC)');
                }
                throw error;
            }
        });
    }

    /** 3 letras de la marca si todos los modelos son de la misma; GEN si hay varias o ninguna. */
    private brandCode(models: Model[]): string {
        const brands = new Map(models.map((m) => [m.brand.brands_id, m.brand.brands_name]));
        if (brands.size !== 1) return 'GEN';
        const [name] = brands.values();
        return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
    }
}
