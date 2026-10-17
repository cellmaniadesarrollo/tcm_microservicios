import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, In } from 'typeorm';
import { ProductType } from '../product-catalogs/entities/product-type.entity';
import { ProductName } from '../product-catalogs/entities/product-name.entity';
import { Color } from '../product-catalogs/entities/color.entity';
import { Quality } from '../product-catalogs/entities/quality.entity';
import { Model } from '../devices-replica/entities/model.entity';
import { BillingMode, TrackingMode } from './enums/product.enums';
import { Product } from './entities/product.entity';
import { ProductImagesService, UploadedFilePayload } from './images/product-images.service';

/** Prefijo del SKU según el kind del tipo. */
const KIND_PREFIX: Record<string, string> = {
    PART: 'REP',
    ACCESSORY: 'ACC',
    DEVICE: 'EQP',
};

/** Áreas de uso por defecto según el kind (se pueden sobreescribir desde el DTO). */
const USAGE_DEFAULTS: Record<string, { sell: boolean; repair: boolean; custom: boolean }> = {
    PART: { sell: false, repair: true, custom: false },
    ACCESSORY: { sell: true, repair: false, custom: false },
    DEVICE: { sell: true, repair: false, custom: false },
};

@Injectable()
export class ProductsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly images: ProductImagesService,
    ) { }

    async create(dto: any, companyId: string, userId: string, files: UploadedFilePayload[] = []) {
        // El id se genera antes para que la key de S3 ya incluya el productId
        const productId = randomUUID();

        // 1. Subir imágenes a S3 (fuera de la transacción, para no retener el lock)
        const uploaded = await this.images.uploadFiles(productId, companyId, files);

        try {
            return await this.dataSource.transaction(async (em) => {
                // Serializa la creación por empresa para que el correlativo no se repita
                await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`products_code:${companyId}`]);

                // 1. Tipo (de aquí sale el kind)
                const type = await em.findOne(ProductType, {
                    where: { id: dto.productTypeId, companyId, status: true },
                });
                if (!type) throw new BadRequestException('El tipo de producto no existe o está inactivo');

                // 2. Nombre del catálogo
                const productName = await em.findOne(ProductName, {
                    where: { id: dto.productNameId, companyId, status: true },
                });
                if (!productName) throw new BadRequestException('El nombre de producto no existe o está inactivo');

                // 3. Color y calidad (opcionales)
                if (dto.colorId) {
                    const ok = await em.exists(Color, { where: { id: dto.colorId, companyId, status: true } });
                    if (!ok) throw new BadRequestException('El color no existe o está inactivo');
                }
                if (dto.qualityId) {
                    const ok = await em.exists(Quality, { where: { id: dto.qualityId, companyId, status: true } });
                    if (!ok) throw new BadRequestException('La calidad no existe o está inactiva');
                }

                // 4. Modelos compatibles
                const modelIds: number[] = [...new Set<number>(dto.modelIds ?? [])];
                const models = modelIds.length
                    ? await em.find(Model, { where: { models_id: In(modelIds) }, relations: { brand: true } })
                    : [];
                if (models.length !== modelIds.length) {
                    throw new BadRequestException('Alguno de los modelos indicados no existe');
                }

                // 5. Reglas por kind
                let trackingMode: TrackingMode = dto.trackingMode ?? TrackingMode.QUANTITY;
                if (type.kind === 'DEVICE') {
                    if (modelIds.length !== 1) {
                        throw new BadRequestException('Un equipo completo debe tener exactamente un modelo');
                    }
                    trackingMode = TrackingMode.SERIAL; // lo exige el CHECK de la tabla
                }

                // 6. Áreas de uso (defaults por kind, sobreescribibles)
                const d = USAGE_DEFAULTS[type.kind] ?? { sell: true, repair: false, custom: false };
                const isSellable = dto.isSellable ?? d.sell;
                const isRepairPart = dto.isRepairPart ?? d.repair;
                const isCustomizable = dto.isCustomizable ?? d.custom;
                if (!isSellable && !isRepairPart && !isCustomizable) {
                    throw new BadRequestException('El producto debe usarse en al menos un área');
                }

                // 7. Correlativo por empresa y SKU
                const row = await em
                    .createQueryBuilder(Product, 'p')
                    .select('COALESCE(MAX(p.code), 0) + 1', 'next')
                    .where('p.companyId = :companyId', { companyId })
                    .getRawOne<{ next: string | number }>();

                const code = Number(row?.next ?? 1);
                const paddedCode = String(code).padStart(6, '0');
                const sku = [
                    KIND_PREFIX[type.kind] ?? 'GEN',
                    type.code,
                    this.brandCode(models),
                    paddedCode,
                ].join('-');

                // 8. Guardar producto (compatibleModels tiene cascade) + imágenes
                try {
                    const product = await em.save(
                        em.create(Product, {
                            id: productId,
                            companyId,
                            code,
                            sku,
                            upc: dto.upc?.trim() || paddedCode,
                            productNameId: productName.id,
                            description: dto.description,
                            kind: type.kind,
                            trackingMode,
                            productTypeId: type.id,
                            colorId: dto.colorId,
                            qualityId: dto.qualityId,
                            isSellable,
                            isRepairPart,
                            isCustomizable,
                            minStock: dto.minStock ?? 0,
                            warrantyDays: dto.warrantyDays ?? 0,
                            basePrice: String(dto.basePrice ?? 0),
                            hasTax: dto.hasTax ?? true,
                            billingMode: dto.billingMode ?? BillingMode.NO,
                            billableInRepairOrders: dto.billableInRepairOrders ?? false,
                            compatibleModels: modelIds.map((modelId) => ({ modelId })),
                        }),
                    );

                    // Registrar imágenes en la misma transacción
                    await this.images.insertImages(em, product.id, uploaded, userId);

                    return {
                        id: product.id,
                        code: product.code,
                        sku: product.sku,
                        name: productName.name,
                        imagesCount: uploaded.length,
                    };
                } catch (error: any) {
                    if (error.code === '23505') {
                        const detail = String(error.constraint ?? error.detail ?? '');
                        if (detail.includes('upc')) {
                            throw new ConflictException('Ya existe un producto con ese código de barras (UPC)');
                        }
                        throw new ConflictException('Conflicto al generar el código del producto, intenta de nuevo');
                    }
                    throw error;
                }
            });
        } catch (error) {
            // Si la transacción falló, no dejamos archivos huérfanos en S3
            await this.images.cleanup(uploaded.map((u) => u.key));
            throw error;
        }
    }

    /** 3 letras de la marca si todos los modelos son de la misma; GEN si hay varias o ninguna. */
    private brandCode(models: Model[]): string {
        const brands = new Map(models.map((m) => [m.brand.brands_id, m.brand.brands_name]));
        if (brands.size !== 1) return 'GEN';
        const [name] = brands.values();
        return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
    }
}