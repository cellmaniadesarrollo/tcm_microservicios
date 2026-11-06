import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { DataSource, In, MoreThan } from 'typeorm';
import { ProductType } from '../product-catalogs/entities/product-type.entity';
import { ProductName } from '../product-catalogs/entities/product-name.entity';
import { Color } from '../product-catalogs/entities/color.entity';
import { Quality } from '../product-catalogs/entities/quality.entity';
import { ProductUsage } from '../product-catalogs/entities/product-usage.entity';
import { Model } from '../devices-replica/entities/model.entity';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { StockBalance } from '../stock/entities/stock-balance.entity';
import { TrackingMode } from './enums/product.enums';
import { Product } from './entities/product.entity';
import { ProductModel } from './entities/product-model.entity';
import { ProductUsageLink } from './entities/product-usage-link.entity';
import { ProductImagesService, UploadedFilePayload } from './images/product-images.service';
import { assertBillingConsistency, assertValidDto } from './helpers/product-validation.helpers';
import { buildSku, padCode } from './helpers/sku.helpers';
import { mapProductListItems } from './mappers/product-list.mapper';
import { mapProductDetail } from './mappers/product-detail.mapper';
import { ProductListQuery } from './queries/product-list.query';
import { ProductDetailQuery } from './queries/product-detail.query';
import { ReceiptSearchQuery } from './queries/receipt-search.query';
import { ListProductsQuery } from './types/product-list.types';
import { ProductForReceipt, ReceiptProductItem, SearchProductsForReceiptQuery } from './types/product-receipt.types';

// Compatibilidad: otros módulos pueden seguir importando estos tipos desde products.service
export * from './types/product-list.types';
export * from './types/product-receipt.types';

@Injectable()
export class ProductsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly images: ProductImagesService,
        private readonly audit: AuditLogService,
        private readonly listQuery: ProductListQuery,
        private readonly detailQuery: ProductDetailQuery,
        private readonly receiptQuery: ReceiptSearchQuery,
    ) { }

    // ───────────────────────── Crear ─────────────────────────

    async create(dto: any, companyId: string, userId: string, files: UploadedFilePayload[] = []) {
        assertValidDto(dto);
        assertBillingConsistency(dto.billableInSales ?? false, dto.billableInRepairOrders ?? false);

        // El id se genera antes para que la key de S3 ya incluya el productId
        const productId = randomUUID();

        // 1. Subir imágenes a S3 (fuera de la transacción, para no retener el lock)
        const uploaded = await this.images.uploadFiles(productId, companyId, files);

        let summary: { id: string; code: number; sku: string; name: string; imagesCount: number };

        try {
            summary = await this.dataSource.transaction(async (em) => {
                // Serializa la creación por empresa para que el correlativo no se repita
                await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`products_code:${companyId}`]);

                // 1. Tipo (de aquí sale el kind)
                const type = await em.findOne(ProductType, {
                    where: { id: dto.productTypeId, companyId, status: true },
                });
                if (!type) {
                    throw new RpcException(
                        new BadRequestException('El tipo de producto no existe o está inactivo'),
                    );
                }

                // 2. Nombre del catálogo
                const productName = await em.findOne(ProductName, {
                    where: { id: dto.productNameId, companyId, status: true },
                });
                if (!productName) {
                    throw new RpcException(
                        new BadRequestException('El nombre de producto no existe o está inactivo'),
                    );
                }

                // 3. Color y calidad (opcionales)
                if (dto.colorId) {
                    const ok = await em.exists(Color, { where: { id: dto.colorId, companyId, status: true } });
                    if (!ok) {
                        throw new RpcException(new BadRequestException('El color no existe o está inactivo'));
                    }
                }
                if (dto.qualityId) {
                    const ok = await em.exists(Quality, { where: { id: dto.qualityId, companyId, status: true } });
                    if (!ok) {
                        throw new RpcException(new BadRequestException('La calidad no existe o está inactiva'));
                    }
                }

                // 4. Modelos compatibles
                const modelIds: number[] = [...new Set<number>(dto.modelIds ?? [])];
                const models = modelIds.length
                    ? await em.find(Model, { where: { models_id: In(modelIds) }, relations: { brand: true } })
                    : [];
                if (models.length !== modelIds.length) {
                    throw new RpcException(new BadRequestException('Alguno de los modelos indicados no existe'));
                }

                // 5. Reglas por kind
                let trackingMode: TrackingMode = dto.trackingMode ?? TrackingMode.QUANTITY;
                if (type.kind === 'DEVICE') {
                    if (modelIds.length !== 1) {
                        throw new RpcException(
                            new BadRequestException('Un equipo completo debe tener exactamente un modelo'),
                        );
                    }
                    trackingMode = TrackingMode.SERIAL; // lo exige el CHECK de la tabla
                }

                // 6. Usos del producto (catálogo por empresa)
                const usageIds: string[] = [...new Set<string>(dto.usageIds ?? [])];
                if (usageIds.length === 0) {
                    throw new RpcException(
                        new BadRequestException('El producto debe usarse en al menos un área'),
                    );
                }
                const usages = await em.find(ProductUsage, {
                    where: { id: In(usageIds), companyId, status: true },
                    select: { id: true },
                });
                if (usages.length !== usageIds.length) {
                    throw new RpcException(
                        new BadRequestException('Alguno de los usos indicados no existe o está inactivo'),
                    );
                }

                // 7. Correlativo por empresa y SKU
                const row = await em
                    .createQueryBuilder(Product, 'p')
                    .select('COALESCE(MAX(p.code), 0) + 1', 'next')
                    .where('p.companyId = :companyId', { companyId })
                    .getRawOne<{ next: string | number }>();

                const code = Number(row?.next ?? 1);
                const paddedCode = padCode(code);
                const sku = buildSku(type.kind, type.code, models, code);

                // 8. Guardar producto (compatibleModels y usages tienen cascade) + imágenes
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
                            minStock: dto.minStock ?? 0,
                            // Valores por defecto para nuevos lotes
                            warrantyDays: dto.warrantyDays ?? 0,
                            basePrice: Number(dto.basePrice ?? 0).toFixed(2),
                            hasTax: dto.hasTax ?? true,
                            priceIncludesTax: dto.priceIncludesTax ?? true,
                            billableInSales: dto.billableInSales ?? false,
                            billableInRepairOrders: dto.billableInRepairOrders ?? false,
                            compatibleModels: modelIds.map((modelId) => ({ modelId })),
                            usages: usageIds.map((usageId) => ({ usageId })),
                        }),
                    );
                    await this.audit.log(em, {
                        companyId, entity: Product, entityId: product.id,
                        action: AuditAction.CREATED, userId,
                    });
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
                            throw new RpcException(
                                new ConflictException('Ya existe un producto con ese código de barras (UPC)'),
                            );
                        }
                        throw new RpcException(
                            new ConflictException('Conflicto al generar el código del producto, intenta de nuevo'),
                        );
                    }
                    throw error;
                }
            });
        } catch (error) {
            // Si la transacción falló, no dejamos archivos huérfanos en S3
            await this.images.cleanup(uploaded.map((u) => u.key));
            throw error;
        }

        // Fuera del try: el producto ya está confirmado, no se deben borrar sus imágenes
        const { items } = await this.searchForReceipt({ id: summary.id }, companyId);

        return { ...summary, option: items[0] ?? null };
    }

    // ───────────────────────── Listado ─────────────────────────

    /**
     * Lista productos con paginación, filtros y búsqueda por palabras
     * (ver `ProductListQuery`). Ej: "bat sam a12" o "sam bateria a12".
     *
     * Nota: hasTax, priceIncludesTax, billableInSales, billableInRepairOrders, warrantyDays y basePrice son
     * valores POR DEFECTO para nuevos lotes (no la condición real de lo que hay en stock).
     */
    async list(query: ListProductsQuery, companyId: string) {
        const { rows, total, page, limit } = await this.listQuery.findPage(query, companyId);
        const extras = await this.listQuery.loadExtras(rows, companyId);

        const includeFilters = query.includeFilters === true || query.includeFilters === 'true';

        return {
            items: mapProductListItems(rows, extras),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            ...(includeFilters ? { filters: await this.listQuery.buildFilters(companyId) } : {}),
        };
    }

    /** Opciones {id, name} para llenar los selects de filtros del listado. */
    listFilters(companyId: string) {
        return this.listQuery.listFilters(companyId);
    }

    // ───────────────────────── Editar ─────────────────────────

    async update(id: string, dto: any, companyId: string, userId: string) {
        const bad = (msg: string) => new RpcException(new BadRequestException(msg));

        assertValidDto(dto);

        return this.dataSource.transaction(async (em) => {
            // Bloquea la fila para que dos ediciones simultáneas no se pisen
            const product = await em.findOne(Product, {
                where: { id, companyId, status: true },
                lock: { mode: 'pessimistic_write' },
            });
            if (!product) {
                throw new RpcException(new NotFoundException('El producto no existe o está inactivo'));
            }

            const patch: Record<string, any> = {};   // columnas de products
            const before: Record<string, any> = {};  // para auditoría
            const after: Record<string, any> = {};
            let relationsChanged = false;            // cambió algo en modelos o usos

            const set = (key: string, value: any) => {
                patch[key] = value;
                before[key] = (product as any)[key] ?? null;
                after[key] = value;
            };

            // ── Catálogos ──
            if (dto.productNameId !== undefined) {
                const ok = await em.exists(ProductName, {
                    where: { id: dto.productNameId, companyId, status: true },
                });
                if (!ok) throw bad('El nombre de producto no existe o está inactivo');
                set('productNameId', dto.productNameId);
            }
            if (dto.colorId !== undefined) {
                if (dto.colorId !== null) {
                    const ok = await em.exists(Color, { where: { id: dto.colorId, companyId, status: true } });
                    if (!ok) throw bad('El color no existe o está inactivo');
                }
                set('colorId', dto.colorId);
            }
            if (dto.qualityId !== undefined) {
                if (dto.qualityId !== null) {
                    const ok = await em.exists(Quality, { where: { id: dto.qualityId, companyId, status: true } });
                    if (!ok) throw bad('La calidad no existe o está inactiva');
                }
                set('qualityId', dto.qualityId);
            }

            // ── Campos simples ──
            if (dto.description !== undefined) set('description', dto.description?.trim() || null);
            if (dto.upc !== undefined) {
                // Sin UPC se vuelve al correlativo con ceros, igual que al crear
                set('upc', dto.upc?.trim() || padCode(product.code));
            }
            if (dto.minStock !== undefined) set('minStock', dto.minStock);

            // ── Valores por defecto para nuevos lotes ──
            // Editarlos NO afecta lotes ya ingresados (cada lote guarda su propia copia).
            if (dto.warrantyDays !== undefined) set('warrantyDays', dto.warrantyDays);
            if (dto.basePrice !== undefined) set('basePrice', Number(dto.basePrice).toFixed(2));
            if (dto.hasTax !== undefined) set('hasTax', dto.hasTax);
            if (dto.priceIncludesTax !== undefined) set('priceIncludesTax', dto.priceIncludesTax);
            if (dto.billableInSales !== undefined) set('billableInSales', dto.billableInSales);
            if (dto.billableInRepairOrders !== undefined) {
                set('billableInRepairOrders', dto.billableInRepairOrders);
            }
            // Se valida con los valores resultantes (los enviados o, si no, los actuales)
            assertBillingConsistency(
                dto.billableInSales ?? product.billableInSales,
                dto.billableInRepairOrders ?? product.billableInRepairOrders,
            );

            // ── Modelos compatibles (se aplican solo las diferencias) ──
            if (dto.modelIds !== undefined) {
                const nextIds = [...new Set<number>(dto.modelIds)].sort((a, b) => a - b);

                if (nextIds.length) {
                    const count = await em.count(Model, { where: { models_id: In(nextIds) } });
                    if (count !== nextIds.length) throw bad('Alguno de los modelos indicados no existe');
                }
                if (product.kind === 'DEVICE' && nextIds.length !== 1) {
                    throw bad('Un equipo completo debe tener exactamente un modelo');
                }

                const current = await em.find(ProductModel, { where: { productId: id } });
                const currentIds = current.map((c) => c.modelId).sort((a, b) => a - b);
                const toRemove = currentIds.filter((m) => !nextIds.includes(m));
                const toAdd = nextIds.filter((m) => !currentIds.includes(m));

                if (toRemove.length) {
                    await em.delete(ProductModel, { productId: id, modelId: In(toRemove) });
                }
                if (toAdd.length) {
                    await em.insert(ProductModel, toAdd.map((modelId) => ({ productId: id, modelId })));
                }
                if (toRemove.length || toAdd.length) relationsChanged = true;
                before.modelIds = currentIds;
                after.modelIds = nextIds;
            }

            // ── Usos ──
            if (dto.usageIds !== undefined) {
                const nextIds = [...new Set<string>(dto.usageIds)].sort();
                if (nextIds.length === 0) throw bad('El producto debe usarse en al menos un área');

                const count = await em.count(ProductUsage, {
                    where: { id: In(nextIds), companyId, status: true },
                });
                if (count !== nextIds.length) throw bad('Alguno de los usos indicados no existe o está inactivo');

                const current = await em.find(ProductUsageLink, { where: { productId: id } });
                const currentIds = current.map((c) => c.usageId).sort();
                const toRemove = currentIds.filter((u) => !nextIds.includes(u));
                const toAdd = nextIds.filter((u) => !currentIds.includes(u));

                if (toRemove.length) {
                    await em.delete(ProductUsageLink, { productId: id, usageId: In(toRemove) });
                }
                if (toAdd.length) {
                    await em.insert(ProductUsageLink, toAdd.map((usageId) => ({ productId: id, usageId })));
                }
                if (toRemove.length || toAdd.length) relationsChanged = true;
                before.usageIds = currentIds;
                after.usageIds = nextIds;
            }

            // Si solo cambiaron modelos o usos, igual se refresca "última modificación"
            if (relationsChanged) patch.updatedAt = new Date();

            // ── Guardar ──
            try {
                if (Object.keys(patch).length) {
                    await em.update(Product, { id, companyId }, patch);
                }
            } catch (error: any) {
                if (error.code === '23505') {
                    throw new RpcException(
                        new ConflictException('Ya existe un producto con ese código de barras (UPC)'),
                    );
                }
                throw error;
            }

            // Si no hubo cambios reales, log() no escribe nada
            await this.audit.log(em, {
                companyId, entity: Product, entityId: id,
                action: AuditAction.UPDATED, userId, before, after,
            });

            return { id: product.id, code: product.code, sku: product.sku };
        });
    }

    // ───────────────────────── Desactivar / reactivar ─────────────────────────

    async remove(id: string, companyId: string, userId: string) {
        return this.dataSource.transaction(async (em) => {
            const product = await em.findOne(Product, {
                where: { id, companyId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!product) {
                throw new RpcException(new NotFoundException('El producto no existe'));
            }
            if (!product.status) {
                throw new RpcException(new ConflictException('El producto ya está inactivo'));
            }

            // No se desactiva un producto con existencias en alguna sucursal
            const hasStock = await em.exists(StockBalance, {
                where: { productId: id, companyId, onHand: MoreThan(0) },
            });
            if (hasStock) {
                throw new RpcException(
                    new ConflictException('El producto tiene existencias; no se puede desactivar'),
                );
            }
            // TODO: bloquear también si tiene órdenes activas (cuando exista el módulo)

            await em.update(Product, { id, companyId }, { status: false });

            await this.audit.log(em, {
                companyId, entity: Product, entityId: id,
                action: AuditAction.DELETED, userId,
                before: { code: product.code, sku: product.sku, upc: product.upc, status: true },
            });

            return { id, sku: product.sku, deleted: true };
        });
    }

    /** Reactiva un producto desactivado. El SKU y el UPC siguen siendo los mismos. */
    async restore(id: string, companyId: string, userId: string) {
        return this.dataSource.transaction(async (em) => {
            const product = await em.findOne(Product, {
                where: { id, companyId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!product) {
                throw new RpcException(new NotFoundException('El producto no existe'));
            }
            if (product.status) {
                throw new RpcException(new ConflictException('El producto ya está activo'));
            }

            await em.update(Product, { id, companyId }, { status: true });

            // Se usa UPDATED para no depender de un valor nuevo en el enum de auditoría.
            // Si prefieres, agrega AuditAction.RESTORED y cámbialo aquí.
            await this.audit.log(em, {
                companyId, entity: Product, entityId: id,
                action: AuditAction.UPDATED, userId,
                before: { status: false },
                after: { status: true },
            });

            return { id, sku: product.sku, restored: true };
        });
    }

    // ───────────────────────── Consultas ─────────────────────────

    async findOne(id: string, companyId: string) {
        const data = await this.detailQuery.load(id, companyId);
        return mapProductDetail(data);
    }

    async history(id: string, companyId: string, page = 1, limit = 20) {
        const exists = await this.dataSource.getRepository(Product).exists({ where: { id, companyId } });
        if (!exists) throw new RpcException(new NotFoundException('El producto no existe'));

        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        return this.audit.history(companyId, Product, id, safePage, safeLimit);
    }

    // ───────────────────────── Módulo de ingresos ─────────────────────────

    /** Uso INTERNO (módulo de ingresos). Falla si algún producto no existe, es de otra empresa o está inactivo. */
    findForReceipt(ids: string[], companyId: string): Promise<ProductForReceipt[]> {
        return this.receiptQuery.findProducts(ids, companyId);
    }

    /** Para otros módulos (SRI): items con la misma forma del buscador, por lista de ids. */
    findReceiptItemsByIds(
        ids: string[],
        companyId: string,
        supplierId?: string,
    ): Promise<Map<string, ReceiptProductItem>> {
        return this.receiptQuery.findItemsByIds(ids, companyId, supplierId);
    }

    searchForReceipt(query: SearchProductsForReceiptQuery, companyId: string) {
        return this.receiptQuery.search(query, companyId);
    }
}