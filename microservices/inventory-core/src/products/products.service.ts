import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { Brackets, DataSource, In, MoreThan } from 'typeorm';
import { ProductType } from '../product-catalogs/entities/product-type.entity';
import { ProductName } from '../product-catalogs/entities/product-name.entity';
import { Color } from '../product-catalogs/entities/color.entity';
import { Quality } from '../product-catalogs/entities/quality.entity';
import { Model } from '../devices-replica/entities/model.entity';
import { ProductKind } from '../common/enums/product-kind.enum';
import { TrackingMode } from './enums/product.enums';
import { Product } from './entities/product.entity';
import { ProductModel } from './entities/product-model.entity';
import { ProductImagesService, UploadedFilePayload } from './images/product-images.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ProductUsage } from '../product-catalogs/entities/product-usage.entity';
import { ProductUsageLink } from './entities/product-usage-link.entity';
import { StockBalance } from '../stock/entities/stock-balance.entity';
import { StockUnitSerial } from '../stock/entities/stock-unit-serial.entity';




const DETAIL_MAX_LOTS = 50;
const DETAIL_MAX_UNITS = 200;
const DETAIL_MAX_MOVEMENTS = 30;
export type ProductSortBy = 'createdAt' | 'code' | 'sku' | 'name' | 'basePrice' | 'stock';
export type StockStatus = 'OUT' | 'LOW' | 'OK';

/** Stock disponible de un producto (suma de todos sus lotes y sucursales). */
const AVAILABLE_SQL = `(COALESCE(sb.on_hand, 0) - COALESCE(sb.reserved, 0))`;

const SORT_COLUMNS: Record<ProductSortBy, string> = {
    createdAt: 'p.createdAt',
    code: 'p.code',
    sku: 'p.sku',
    name: 'pn.name',
    basePrice: 'p.basePrice',
    stock: AVAILABLE_SQL,
};

const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
    OUT: 'Sin stock',
    LOW: 'Stock bajo',
    OK: 'Con stock',
};

const deriveStockStatus = (available: number, minStock: number): StockStatus =>
    available <= 0 ? 'OUT' : available <= minStock ? 'LOW' : 'OK';

export interface ListProductsQuery {
    page?: number;
    limit?: number;
    search?: string;
    productTypeId?: string;
    kind?: ProductKind;
    usageId?: string;
    qualityId?: string;                 // <- nuevo
    trackingMode?: TrackingMode;        // <- nuevo
    stockStatus?: StockStatus;          // <- nuevo
    includeFilters?: boolean | string;  // <- nuevo
    sortBy?: ProductSortBy;
    sortDir?: 'ASC' | 'DESC';
}





export interface SearchProductsForReceiptQuery {
    search?: string;
    limit?: number;
    kind?: ProductKind;
    id?: string;
}
/** Escapa los comodines de LIKE para que "50%" o "a_13" se busquen literalmente. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
/** Prefijo del SKU según el kind del tipo. */
const KIND_PREFIX: Record<string, string> = {
    PART: 'REP',
    ACCESSORY: 'ACC',
    DEVICE: 'EQP',
};

// ───────────────────────── Listado ─────────────────────────
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_TOKENS = 6;
/** numeric(12,2) admite hasta 9999999999.99 */
const MAX_PRICE = 9_999_999_999.99;



/** Minúsculas y sin tildes en SQL (sin depender de la extensión unaccent). */
const norm = (expr: string) => `translate(lower(${expr}), 'áéíóúüñ', 'aeiouun')`;

/** Lo mismo, del lado de JS, para que el token coincida con `norm`. */
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** El token puede coincidir con la marca, el modelo o el código técnico de algún modelo compatible. */
const modelSearchSql = (key: string) => `EXISTS (
    SELECT 1 FROM product_models pm
    JOIN models mo ON mo.models_id = pm.model_id
    JOIN brands br ON br.brands_id = mo.models_brands_id
    WHERE pm.product_id = "p"."id"
    AND (
        ${norm('mo.models_name')} LIKE :${key}
        OR ${norm('br.brands_name')} LIKE :${key}
        OR EXISTS (
            SELECT 1 FROM model_technical_codes tc
            WHERE tc.mtc_models_id = mo.models_id AND lower(tc.mtc_code) LIKE :${key}
        )
    )
)`;

/**
 * Datos de un producto que necesita el módulo de ingresos (y otros módulos internos).
 * Los campos de `defaults` solo PRECARGAN la línea del ingreso; el lote guarda su propia copia.
 */
export interface ProductForReceipt {
    id: string;
    code: number;
    sku: string;
    name: string;
    kind: ProductKind;
    trackingMode: TrackingMode;
    modelIds: number[];
    defaults: {
        warrantyDays: number;
        basePrice: string;
        hasTax: boolean;
        billableInSales: boolean;
        priceIncludesTax: boolean;
        billableInRepairOrders: boolean;
    };
}

@Injectable()
export class ProductsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly images: ProductImagesService,
        private readonly audit: AuditLogService
    ) { }

    // ───────────────────────── Validaciones propias ─────────────────────────

    /**
     * Valida números y enums del DTO también en este servicio (llega por RPC y no
     * se debe confiar en que el gateway ya lo hizo). Solo revisa lo que viene definido.
     */
    private assertValidDto(dto: any) {
        const bad = (msg: string) => new RpcException(new BadRequestException(msg));

        const isSet = (v: unknown) => v !== undefined && v !== null;

        for (const [key, label] of [
            ['minStock', 'El stock mínimo'],
            ['warrantyDays', 'La garantía'],
        ] as const) {
            if (isSet(dto[key]) && (!Number.isInteger(Number(dto[key])) || Number(dto[key]) < 0)) {
                throw bad(`${label} debe ser un entero mayor o igual a 0`);
            }
        }

        if (isSet(dto.basePrice)) {
            const price = Number(dto.basePrice);
            if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
                throw bad('El precio base debe ser un número mayor o igual a 0');
            }
        }

        for (const key of ['hasTax', 'priceIncludesTax', 'billableInSales', 'billableInRepairOrders'] as const) {
            if (isSet(dto[key]) && typeof dto[key] !== 'boolean') {
                throw bad(`${key} debe ser verdadero o falso`);
            }
        }

        if (isSet(dto.trackingMode) && !Object.values(TrackingMode).includes(dto.trackingMode)) {
            throw bad('El modo de seguimiento no es válido');
        }
    }

    /** Regla: facturable en órdenes de reparación exige facturable en ventas. */
    private assertBillingConsistency(billableInSales: boolean, billableInRepairOrders: boolean) {
        if (billableInRepairOrders && !billableInSales) {
            throw new RpcException(
                new BadRequestException(
                    'Un producto facturable en órdenes de reparación también debe ser facturable en ventas',
                ),
            );
        }
    }

    // ───────────────────────── Crear ─────────────────────────

    async create(dto: any, companyId: string, userId: string, files: UploadedFilePayload[] = []) {
        this.assertValidDto(dto);
        this.assertBillingConsistency(dto.billableInSales ?? false, dto.billableInRepairOrders ?? false);

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
                        throw new RpcException(
                            new BadRequestException('El color no existe o está inactivo'),
                        );
                    }
                }
                if (dto.qualityId) {
                    const ok = await em.exists(Quality, { where: { id: dto.qualityId, companyId, status: true } });
                    if (!ok) {
                        throw new RpcException(
                            new BadRequestException('La calidad no existe o está inactiva'),
                        );
                    }
                }

                // 4. Modelos compatibles
                const modelIds: number[] = [...new Set<number>(dto.modelIds ?? [])];
                const models = modelIds.length
                    ? await em.find(Model, { where: { models_id: In(modelIds) }, relations: { brand: true } })
                    : [];
                if (models.length !== modelIds.length) {
                    throw new RpcException(
                        new BadRequestException('Alguno de los modelos indicados no existe'),
                    );
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
                const paddedCode = String(code).padStart(6, '0');
                const sku = [
                    KIND_PREFIX[type.kind] ?? 'GEN',
                    type.code,
                    this.brandCode(models),
                    paddedCode,
                ].join('-');

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
        const { items } = await this.searchForReceipt({ id: summary.id } as any, companyId);

        return { ...summary, option: items[0] ?? null };
    }
    // ───────────────────────── Listado paginado ─────────────────────────

    /**
     * Lista productos con paginación, filtros y búsqueda por palabras.
     * Cada palabra del texto debe coincidir (AND) con alguno de estos campos (OR):
     * nombre, tipo, SKU, UPC, color, calidad, o la marca / modelo / código técnico de un modelo compatible.
     * Ej: "bat sam a12" o "sam bateria a12". Ignora mayúsculas y tildes.
     *
     * Nota: hasTax, priceIncludesTax, billableInSales, billableInRepairOrders, warrantyDays y basePrice son
     * valores POR DEFECTO para nuevos lotes (no la condición real de lo que hay en stock).
     */
    async list(query: ListProductsQuery, companyId: string) {
        const bad400 = (m: string) => new RpcException(new BadRequestException(m));

        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));

        if (query.stockStatus && !['OUT', 'LOW', 'OK'].includes(query.stockStatus)) throw bad400('El estado de stock no es válido');
        if (query.trackingMode && !Object.values(TrackingMode).includes(query.trackingMode)) throw bad400('El modo de seguimiento no es válido');

        const qb = this.dataSource
            .getRepository(Product)
            .createQueryBuilder('p')
            .innerJoin('p.productName', 'pn').addSelect(['pn.id', 'pn.name'])
            .innerJoin('p.productType', 'pt').addSelect(['pt.id', 'pt.name', 'pt.code'])
            .leftJoin('p.color', 'co').addSelect(['co.id', 'co.name', 'co.hex'])
            .leftJoin('p.quality', 'qu').addSelect(['qu.id', 'qu.name'])
            // Stock total por producto (una fila por producto: no duplica filas)
            .leftJoin(
                `(SELECT product_id, SUM(on_hand) AS on_hand, SUM(reserved) AS reserved
              FROM stock_balances WHERE company_id = :companyId GROUP BY product_id)`,
                'sb',
                'sb.product_id = p.id',
            )
            .where('p.companyId = :companyId', { companyId })
            .andWhere('p.status = true');

        // ── Búsqueda por palabras ──
        const tokens = stripAccents(query.search ?? '').split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TOKENS);
        tokens.forEach((token, i) => {
            const key = `tk${i}`;
            qb.andWhere(
                new Brackets((w) => {
                    w.where(`${norm('pn.name')} LIKE :${key}`)
                        .orWhere(`${norm('pt.name')} LIKE :${key}`)
                        .orWhere(`lower(p.sku) LIKE :${key}`)
                        .orWhere(`lower(p.upc) LIKE :${key}`)
                        .orWhere(`${norm('co.name')} LIKE :${key}`)
                        .orWhere(`${norm('qu.name')} LIKE :${key}`)
                        .orWhere(modelSearchSql(key));
                    // Un entero también puede ser el código del producto
                    if (/^\d{1,9}$/.test(token)) w.orWhere(`p.code = :n${i}`, { [`n${i}`]: Number(token) });
                }),
            );
            qb.setParameter(key, `%${token.replace(/[\\%_]/g, '\\$&')}%`);
        });

        // ── Filtros ──
        if (query.productTypeId) qb.andWhere('p.productTypeId = :productTypeId', { productTypeId: query.productTypeId });
        if (query.kind) qb.andWhere('p.kind = :kind', { kind: query.kind });
        if (query.qualityId) qb.andWhere('p.qualityId = :qualityId', { qualityId: query.qualityId });
        if (query.trackingMode) qb.andWhere('p.trackingMode = :trackingMode', { trackingMode: query.trackingMode });
        if (query.usageId) {
            qb.andWhere(
                `EXISTS (SELECT 1 FROM product_usage_links ul WHERE ul.product_id = "p"."id" AND ul.usage_id = :usageId)`,
                { usageId: query.usageId },
            );
        }
        if (query.stockStatus === 'OUT') qb.andWhere(`${AVAILABLE_SQL} <= 0`);
        if (query.stockStatus === 'LOW') qb.andWhere(`${AVAILABLE_SQL} > 0 AND ${AVAILABLE_SQL} <= p.minStock`);
        if (query.stockStatus === 'OK') qb.andWhere(`${AVAILABLE_SQL} > 0 AND ${AVAILABLE_SQL} > p.minStock`);

        // ── Total, orden y paginación ──
        const total = await qb.getCount();

        const sortBy: ProductSortBy = query.sortBy && SORT_COLUMNS[query.sortBy] ? query.sortBy : 'createdAt';
        const defaultDir = sortBy === 'createdAt' ? 'DESC' : 'ASC';
        const sortDir = query.sortDir === 'ASC' || query.sortDir === 'DESC' ? query.sortDir : defaultDir;

        const rows = await qb
            .orderBy(SORT_COLUMNS[sortBy], sortDir)
            .addOrderBy('p.id', 'ASC')
            .offset((page - 1) * limit)
            .limit(limit)
            .getMany();

        // ── Datos de esta página: modelos, usos, imagen, stock y último lote ──
        const ids = rows.map((r) => r.id);
        const [links, usageLinks, imageUrls, stockRows, lastLotRows] = await Promise.all([
            ids.length
                ? this.dataSource.getRepository(ProductModel).find({ where: { productId: In(ids) }, relations: { model: { brand: true } } })
                : Promise.resolve([] as ProductModel[]),
            ids.length
                ? this.dataSource.getRepository(ProductUsageLink).find({ where: { productId: In(ids) }, relations: { usage: true } })
                : Promise.resolve([] as ProductUsageLink[]),
            this.images.primaryImageUrls(ids),
            ids.length
                ? this.dataSource.query(
                    `SELECT b.product_id AS "productId",
                        COALESCE(SUM(b.on_hand), 0) AS "onHand",
                        COALESCE(SUM(b.reserved), 0) AS "reserved",
                        COALESCE(SUM(CASE WHEN l.billable_in_sales THEN b.on_hand - b.reserved ELSE 0 END), 0) AS "availableBillableInSales",
                        COALESCE(SUM(CASE WHEN l.billable_in_repair_orders THEN b.on_hand - b.reserved ELSE 0 END), 0) AS "availableBillableInRepairOrders",
                        COUNT(DISTINCT b.lot_id) FILTER (WHERE b.on_hand > 0) AS "lotsWithStock",
                        MIN(l.sale_price) FILTER (WHERE b.on_hand > 0) AS "salePriceMin",
                        MAX(l.sale_price) FILTER (WHERE b.on_hand > 0) AS "salePriceMax"
                 FROM stock_balances b
                 JOIN lots l ON l.id = b.lot_id
                 WHERE b.company_id = $1 AND b.product_id = ANY($2)
                 GROUP BY b.product_id`,
                    [companyId, ids],
                )
                : Promise.resolve([] as any[]),
            ids.length
                ? this.dataSource.query(
                    `SELECT DISTINCT ON (l.product_id)
                        l.product_id AS "productId", l.code, l.unit_cost AS "unitCost",
                        l.sale_price AS "salePrice", l.created_at AS "createdAt"
                 FROM lots l
                 WHERE l.company_id = $1 AND l.product_id = ANY($2)
                 ORDER BY l.product_id, l.created_at DESC, l.code DESC`,
                    [companyId, ids],
                )
                : Promise.resolve([] as any[]),
        ]);

        const modelsByProduct = new Map<string, ProductModel[]>();
        for (const link of links) {
            const list = modelsByProduct.get(link.productId) ?? [];
            list.push(link);
            modelsByProduct.set(link.productId, list);
        }
        const usagesByProduct = new Map<string, ProductUsageLink[]>();
        for (const ul of usageLinks) {
            const list = usagesByProduct.get(ul.productId) ?? [];
            list.push(ul);
            usagesByProduct.set(ul.productId, list);
        }
        const stockByProduct = new Map<string, any>(stockRows.map((r: any) => [r.productId, r] as [string, any]));
        const lastLotByProduct = new Map<string, any>(lastLotRows.map((r: any) => [r.productId, r] as [string, any]));

        const items = rows.map((p) => {
            const productLinks = modelsByProduct.get(p.id) ?? [];
            const brands = new Map<number, string>();
            for (const l of productLinks) brands.set(l.model.brand.brands_id, l.model.brand.brands_name);

            const usages = (usagesByProduct.get(p.id) ?? [])
                .map((ul) => ({ id: ul.usage.id, code: ul.usage.code, name: ul.usage.name, area: ul.usage.area }))
                .sort((a, b) => a.name.localeCompare(b.name));

            const s = stockByProduct.get(p.id);
            const onHand = Number(s?.onHand ?? 0);
            const reserved = Number(s?.reserved ?? 0);
            const available = onHand - reserved;
            const lastLot = lastLotByProduct.get(p.id);

            return {
                id: p.id,
                code: p.code,
                sku: p.sku,
                upc: p.upc ?? null,
                name: p.productName.name,
                description: p.description ?? null,
                kind: p.kind,
                trackingMode: p.trackingMode,
                type: { id: p.productType.id, name: p.productType.name, code: p.productType.code },
                color: p.color ? { id: p.color.id, name: p.color.name, hex: p.color.hex ?? null } : null,
                quality: p.quality ? { id: p.quality.id, name: p.quality.name } : null,
                brands: [...brands].map(([id, name]) => ({ id, name })),
                models: productLinks.map((l) => ({ id: l.model.models_id, name: l.model.models_name })),
                usages,
                minStock: p.minStock,
                warrantyDays: p.warrantyDays,
                basePrice: p.basePrice,
                hasTax: p.hasTax,
                priceIncludesTax: p.priceIncludesTax,
                billableInSales: p.billableInSales,
                billableInRepairOrders: p.billableInRepairOrders,
                status: p.status,
                imageUrl: imageUrls.get(p.id) ?? null,
                createdAt: p.createdAt,
                stock: {
                    onHand,
                    reserved,
                    available,
                    availableBillableInSales: Number(s?.availableBillableInSales ?? 0),
                    availableBillableInRepairOrders: Number(s?.availableBillableInRepairOrders ?? 0),
                    lotsWithStock: Number(s?.lotsWithStock ?? 0),
                    salePriceMin: s?.salePriceMin ?? null,
                    salePriceMax: s?.salePriceMax ?? null,
                    status: deriveStockStatus(available, p.minStock),
                },
                lastLot: lastLot
                    ? { code: Number(lastLot.code), unitCost: lastLot.unitCost, salePrice: lastLot.salePrice, createdAt: lastLot.createdAt }
                    : null,
            };
        });

        const includeFilters = query.includeFilters === true || query.includeFilters === 'true';

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            ...(includeFilters ? { filters: await this.buildListFilters(companyId) } : {}),
        };
    }

    private async buildListFilters(companyId: string) {
        const em = this.dataSource.manager;
        const [types, qualities, usages] = await Promise.all([
            em.find(ProductType, { where: { companyId, status: true }, select: { id: true, name: true, code: true, kind: true }, order: { name: 'ASC' } }),
            em.find(Quality, { where: { companyId, status: true }, select: { id: true, name: true }, order: { name: 'ASC' } }),
            em.find(ProductUsage, { where: { companyId, status: true }, select: { id: true, code: true, name: true, area: true }, order: { name: 'ASC' } }),
        ]);

        return {
            kinds: Object.values(ProductKind).map((value) => ({ value, label: { DEVICE: 'Equipo', PART: 'Repuesto', ACCESSORY: 'Accesorio' }[value] })),
            trackingModes: [
                { value: TrackingMode.QUANTITY, label: 'Por cantidad' },
                { value: TrackingMode.SERIAL, label: 'Por serial/IMEI' },
            ],
            stockStatuses: (Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map((value) => ({ value, label: STOCK_STATUS_LABELS[value] })),
            productTypes: types.map((t) => ({ id: t.id, name: t.name, code: t.code, kind: t.kind })),
            qualities: qualities.map((q) => ({ id: q.id, name: q.name })),
            usages: usages.map((u) => ({ id: u.id, code: u.code, name: u.name, area: u.area })),
            sortOptions: [
                { value: 'createdAt', label: 'Más recientes' },
                { value: 'name', label: 'Nombre' },
                { value: 'code', label: 'Código' },
                { value: 'sku', label: 'SKU' },
                { value: 'basePrice', label: 'Precio base' },
                { value: 'stock', label: 'Stock disponible' },
            ],
        };
    }

    /** Opciones {id, name} para llenar los selects de filtros del listado. */
    async listFilters(companyId: string) {
        const [types, usages] = await Promise.all([
            this.dataSource.getRepository(ProductType).find({
                where: { companyId, status: true },
                select: { id: true, name: true },
                order: { name: 'ASC' },
            }),
            this.dataSource.getRepository(ProductUsage).find({
                where: { companyId, status: true },
                select: { id: true, name: true },
                order: { name: 'ASC' },
            }),
        ]);

        return {
            types,
            kinds: [
                { id: ProductKind.DEVICE, name: 'Equipo' },
                { id: ProductKind.PART, name: 'Repuesto' },
                { id: ProductKind.ACCESSORY, name: 'Accesorio' },
            ],
            usages,
        };
    }

    /** 3 letras de la marca si todos los modelos son de la misma; GEN si hay varias o ninguna. */
    private brandCode(models: Model[]): string {
        const brands = new Map(models.map((m) => [m.brand.brands_id, m.brand.brands_name]));
        if (brands.size !== 1) return 'GEN';
        const [name] = brands.values();
        return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
    }

    // ───────────────────────── Editar ─────────────────────────

    async update(id: string, dto: any, companyId: string, userId: string) {
        const bad = (msg: string) => new RpcException(new BadRequestException(msg));

        this.assertValidDto(dto);

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
                set('upc', dto.upc?.trim() || String(product.code).padStart(6, '0'));
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
            this.assertBillingConsistency(
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
        const p = await this.dataSource.getRepository(Product).findOne({
            where: { id, companyId },
            relations: {
                productName: true,
                productType: true,
                color: true,
                quality: true,
                compatibleModels: { model: { brand: true } },
                usages: { usage: true },
            },
        });
        if (!p) throw new RpcException(new NotFoundException('El producto no existe'));

        const isSerial = p.trackingMode === TrackingMode.SERIAL;

        // Se permite ver inactivos: así se consulta también el historial de un eliminado
        const [images, history, totalsRows, lotRows, unitCounts, unitRows, movementRows] = await Promise.all([
            this.images.list(id, companyId),
            this.audit.history(companyId, Product, id, 1, 20),

            // Resumen de stock (todos los lotes y sucursales)
            this.dataSource.query(
                `SELECT COALESCE(SUM(b.on_hand), 0) AS "onHand",
                    COALESCE(SUM(b.reserved), 0) AS "reserved",
                    COALESCE(SUM(CASE WHEN l.billable_in_sales THEN b.on_hand - b.reserved ELSE 0 END), 0) AS "availableBillableInSales",
                    COALESCE(SUM(CASE WHEN l.billable_in_repair_orders THEN b.on_hand - b.reserved ELSE 0 END), 0) AS "availableBillableInRepairOrders",
                    COUNT(DISTINCT b.lot_id) FILTER (WHERE b.on_hand > 0) AS "lotsWithStock",
                    MIN(l.sale_price) FILTER (WHERE b.on_hand > 0) AS "salePriceMin",
                    MAX(l.sale_price) FILTER (WHERE b.on_hand > 0) AS "salePriceMax",
                    ROUND(SUM(b.on_hand * l.unit_cost) / NULLIF(SUM(b.on_hand), 0), 4) AS "avgUnitCost"
             FROM stock_balances b
             JOIN lots l ON l.id = b.lot_id
             WHERE b.company_id = $1 AND b.product_id = $2`,
                [companyId, id],
            ),

            // Lotes (más recientes primero) con existencias actuales y el ingreso que los originó
            this.dataSource.query(
                `SELECT l.id, l.code, l.origin_type AS "originType",
                    l.quantity_received AS "quantityReceived",
                    l.unit_cost AS "unitCost", l.sale_price AS "salePrice",
                    l.warranty_days AS "warrantyDays", l.has_tax AS "hasTax",
                    l.price_includes_tax AS "priceIncludesTax",
                    l.billable_in_sales AS "billableInSales",
                    l.billable_in_repair_orders AS "billableInRepairOrders",
                    l.created_at AS "createdAt", l.created_by_id AS "createdById",
                    COALESCE(SUM(b.on_hand), 0) AS "onHand",
                    COALESCE(SUM(b.reserved), 0) AS "reserved",
                    r.id AS "receiptId", r.code AS "receiptCode", r.issue_date AS "issueDate",
                    r.document_number AS "documentNumber", r.status AS "receiptStatus",
                    s.business_name AS "supplierName"
             FROM lots l
             LEFT JOIN stock_balances b ON b.lot_id = l.id
             LEFT JOIN receipt_lines rl ON l.origin_type = 'RECEIPT' AND rl.id = l.origin_id
             LEFT JOIN receipts r ON r.id = rl.receipt_id
             LEFT JOIN suppliers s ON s.id = r.supplier_id
             WHERE l.company_id = $1 AND l.product_id = $2
             GROUP BY l.id, r.id, s.id
             ORDER BY l.created_at DESC, l.code DESC
             LIMIT ${DETAIL_MAX_LOTS + 1}`,
                [companyId, id],
            ),

            // Conteo de equipos por estado (solo serializados)
            isSerial
                ? this.dataSource.query(
                    `SELECT status, COUNT(*)::int AS n FROM stock_units
                 WHERE company_id = $1 AND product_id = $2 GROUP BY status`,
                    [companyId, id],
                )
                : Promise.resolve([] as any[]),

            // Equipos más recientes
            isSerial
                ? this.dataSource.query(
                    `SELECT u.id, u.status, u.serial, u.created_at AS "createdAt", l.code AS "lotCode"
                 FROM stock_units u JOIN lots l ON l.id = u.lot_id
                 WHERE u.company_id = $1 AND u.product_id = $2
                 ORDER BY u.created_at DESC
                 LIMIT ${DETAIL_MAX_UNITS + 1}`,
                    [companyId, id],
                )
                : Promise.resolve([] as any[]),

            // Kardex reciente
            this.dataSource.query(
                `SELECT m.id, m.type, m.quantity, m.unit_cost AS "unitCost",
                    m.reference_type AS "referenceType", m.reference_id AS "referenceId",
                    m.created_by_id AS "createdById", m.occurred_at AS "occurredAt",
                    l.code AS "lotCode"
             FROM stock_movements m JOIN lots l ON l.id = m.lot_id
             WHERE m.company_id = $1 AND m.product_id = $2
             ORDER BY m.occurred_at DESC
             LIMIT ${DETAIL_MAX_MOVEMENTS}`,
                [companyId, id],
            ),
        ]);

        // ───── Marcas ─────
        const brands = new Map<number, string>();
        for (const l of p.compatibleModels) {
            brands.set(l.model.brand.brands_id, l.model.brand.brands_name);
        }

        // ───── Stock ─────
        const t = totalsRows[0] ?? {};
        const onHand = Number(t.onHand ?? 0);
        const reserved = Number(t.reserved ?? 0);
        const available = onHand - reserved;

        // ───── Lotes ─────
        const lotsTruncated = lotRows.length > DETAIL_MAX_LOTS;
        const lots = (lotsTruncated ? lotRows.slice(0, DETAIL_MAX_LOTS) : lotRows).map((l: any) => {
            const lotOnHand = Number(l.onHand);
            const lotReserved = Number(l.reserved);
            return {
                id: l.id,
                code: Number(l.code),
                originType: l.originType,
                quantityReceived: Number(l.quantityReceived),
                onHand: lotOnHand,
                reserved: lotReserved,
                available: lotOnHand - lotReserved,
                consumed: Number(l.quantityReceived) - lotOnHand,
                unitCost: l.unitCost,          // neto por unidad, sin impuesto
                salePrice: l.salePrice,
                warrantyDays: Number(l.warrantyDays),
                hasTax: l.hasTax,
                priceIncludesTax: l.priceIncludesTax,
                billableInSales: l.billableInSales,
                billableInRepairOrders: l.billableInRepairOrders,
                createdAt: l.createdAt,
                createdById: l.createdById,
                receipt: l.receiptId
                    ? {
                        id: l.receiptId,
                        code: Number(l.receiptCode),
                        issueDate: l.issueDate,
                        documentNumber: l.documentNumber ?? null,
                        status: l.receiptStatus,
                        supplierName: l.supplierName ?? null,
                    }
                    : null,
            };
        });

        // ───── Equipos con todos sus IMEI ─────
        const unitsTruncated = unitRows.length > DETAIL_MAX_UNITS;
        const shownUnits = unitsTruncated ? unitRows.slice(0, DETAIL_MAX_UNITS) : unitRows;
        const serialRows = shownUnits.length
            ? await this.dataSource.getRepository(StockUnitSerial).find({
                where: { unitId: In(shownUnits.map((u: any) => u.id)) },
                order: { position: 'ASC' },
            })
            : [];
        const serialsByUnit = new Map<string, string[]>();
        for (const s of serialRows) {
            const list = serialsByUnit.get(s.unitId) ?? [];
            list.push(s.value);
            serialsByUnit.set(s.unitId, list);
        }
        const unitsByStatus: Record<string, number> = {};
        for (const r of unitCounts) unitsByStatus[r.status] = Number(r.n);

        return {
            id: p.id,
            code: p.code,
            sku: p.sku,
            upc: p.upc ?? null,
            description: p.description ?? null,
            kind: p.kind,
            trackingMode: p.trackingMode,
            name: { id: p.productName.id, name: p.productName.name },
            type: { id: p.productType.id, name: p.productType.name, code: p.productType.code },
            color: p.color ? { id: p.color.id, name: p.color.name, hex: p.color.hex ?? null } : null,
            quality: p.quality ? { id: p.quality.id, name: p.quality.name } : null,
            brands: [...brands].map(([bid, name]) => ({ id: bid, name })),
            models: p.compatibleModels.map((l) => ({
                id: l.model.models_id,
                name: l.model.models_name,
                brandId: l.model.brand.brands_id,
                brandName: l.model.brand.brands_name,
            })),
            usages: p.usages
                .map((ul) => ({ id: ul.usage.id, code: ul.usage.code, name: ul.usage.name, area: ul.usage.area }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            minStock: p.minStock,
            // Valores por defecto para nuevos lotes
            warrantyDays: p.warrantyDays,
            basePrice: p.basePrice,
            hasTax: p.hasTax,
            priceIncludesTax: p.priceIncludesTax,
            billableInSales: p.billableInSales,
            billableInRepairOrders: p.billableInRepairOrders,
            status: p.status,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            images,

            stock: {
                onHand,
                reserved,
                available,
                availableBillableInSales: Number(t.availableBillableInSales ?? 0),
                availableBillableInRepairOrders: Number(t.availableBillableInRepairOrders ?? 0),
                lotsWithStock: Number(t.lotsWithStock ?? 0),
                salePriceMin: t.salePriceMin ?? null,
                salePriceMax: t.salePriceMax ?? null,
                avgUnitCost: t.avgUnitCost ?? null, // costo promedio ponderado de lo que hay en existencia
                status: deriveStockStatus(available, p.minStock),
            },
            lots,
            lotsTruncated,
            units: isSerial
                ? {
                    byStatus: unitsByStatus,
                    items: shownUnits.map((u: any) => ({
                        id: u.id,
                        status: u.status,
                        lotCode: Number(u.lotCode),
                        serials: serialsByUnit.get(u.id) ?? [u.serial],
                        createdAt: u.createdAt,
                    })),
                    truncated: unitsTruncated,
                }
                : null,
            movements: movementRows.map((m: any) => ({
                id: m.id,
                type: m.type,
                quantity: Number(m.quantity),
                lotCode: Number(m.lotCode),
                unitCost: m.unitCost,
                referenceType: m.referenceType ?? null,
                referenceId: m.referenceId ?? null,
                createdById: m.createdById,
                occurredAt: m.occurredAt,
            })),
            history,
        };
    }
    /**
     * Uso INTERNO (módulo de ingresos). Devuelve lo mínimo para armar una línea de ingreso:
     * identidad, kind, trackingMode, modelos y valores por defecto.
     * Falla si algún producto no existe, es de otra empresa o está inactivo.
     * No arrastra imágenes ni historial (a diferencia de findOne).
     */
    async findForReceipt(ids: string[], companyId: string): Promise<ProductForReceipt[]> {
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0) return [];

        const rows = await this.dataSource.getRepository(Product).find({
            where: { id: In(uniqueIds), companyId },
            relations: { productName: true, compatibleModels: true },
        });

        if (rows.length !== uniqueIds.length) {
            throw new RpcException(new BadRequestException('Alguno de los productos indicados no existe'));
        }
        const inactive = rows.find((p) => !p.status);
        if (inactive) {
            throw new RpcException(
                new BadRequestException(`El producto ${inactive.sku} está inactivo y no puede ingresarse`),
            );
        }

        return rows.map((p) => ({
            id: p.id,
            code: p.code,
            sku: p.sku,
            name: p.productName.name,
            kind: p.kind,
            trackingMode: p.trackingMode,
            modelIds: p.compatibleModels.map((m) => m.modelId),
            defaults: {
                warrantyDays: p.warrantyDays,
                basePrice: p.basePrice,
                hasTax: p.hasTax,
                billableInSales: p.billableInSales,
                priceIncludesTax: p.priceIncludesTax,
                billableInRepairOrders: p.billableInRepairOrders,
            },
        }));
    }

    async history(id: string, companyId: string, page = 1, limit = 20) {
        const exists = await this.dataSource.getRepository(Product).exists({ where: { id, companyId } });
        if (!exists) throw new RpcException(new NotFoundException('El producto no existe'));

        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        return this.audit.history(companyId, Product, id, safePage, safeLimit);
    }
    async searchForReceipt(query: SearchProductsForReceiptQuery, companyId: string) {
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);

        const tokens = stripAccents(String(query.search ?? ''))
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, MAX_SEARCH_TOKENS);

        const qb = this.dataSource
            .createQueryBuilder(Product, 'p')
            .innerJoin('p.productName', 'pn')
            .innerJoin('p.productType', 'pt')
            .leftJoin('p.color', 'co')
            .leftJoin('p.quality', 'qu')
            .select('p.id', 'id')
            .addSelect('p.code', 'code')
            .addSelect('p.sku', 'sku')
            .addSelect('p.upc', 'upc')
            .addSelect('p.kind', 'kind')
            .addSelect('p.trackingMode', 'trackingMode')
            .addSelect('pn.name', 'name')
            .addSelect('pt.code', 'typeCode')
            .addSelect('co.name', 'colorName')
            .addSelect('qu.name', 'qualityName')
            .addSelect('p.warrantyDays', 'warrantyDays')
            .addSelect('p.basePrice', 'basePrice')
            .addSelect('p.hasTax', 'hasTax')
            .addSelect('p.priceIncludesTax', 'priceIncludesTax')
            .addSelect('p.billableInSales', 'billableInSales')
            .addSelect('p.billableInRepairOrders', 'billableInRepairOrders')
            .where('p.companyId = :companyId', { companyId })
            .andWhere('p.status = true');

        if (query.kind) qb.andWhere('p.kind = :kind', { kind: query.kind });
        if (query.id) qb.andWhere('p.id = :id', { id: query.id });
        tokens.forEach((token, i) => {
            const key = `t${i}`;
            const numKey = `n${i}`;
            const params: Record<string, unknown> = { [key]: `%${escapeLike(token)}%` };

            qb.andWhere(
                new Brackets((w) => {
                    w.where(`${norm('pn.name')} LIKE :${key}`)
                        .orWhere(`lower(p.sku) LIKE :${key}`)
                        .orWhere(`lower(p.upc) LIKE :${key}`)
                        .orWhere(modelSearchSql(key));

                    // Un número entero también puede ser el código del producto
                    if (/^\d{1,9}$/.test(token)) {
                        w.orWhere(`p.code = :${numKey}`);
                        params[numKey] = Number(token);
                    }
                }),
            );
            qb.setParameters(params);
        });

        // Si lo escrito es solo un número, el producto con ese código exacto va primero
        // Si lo escrito es solo un número, el producto con ese código exacto va primero
        const onlyCode = tokens.length === 1 && /^\d{1,9}$/.test(tokens[0]) ? Number(tokens[0]) : null;
        if (onlyCode !== null) {
            qb.addSelect('CASE WHEN p.code = :exactCode THEN 0 ELSE 1 END', 'rank')
                .setParameter('exactCode', onlyCode)
                .orderBy('rank', 'ASC')
                .addOrderBy('p.createdAt', 'DESC');
        } else {
            qb.orderBy('p.createdAt', 'DESC')
                .addOrderBy('p.code', 'DESC');
        }

        const rows = await qb.limit(limit).getRawMany();
        if (!rows.length) return { items: [] };

        const ids: string[] = rows.map((r) => r.id);

        // Modelos compatibles (para mostrar "Samsung A13") y último ingreso, en dos consultas para toda la página
        const [modelRows, lastRows] = await Promise.all([
            this.dataSource.query(
                `SELECT pm.product_id AS "productId", mo.models_id AS "modelId",
                    mo.models_name AS "modelName", br.brands_name AS "brandName"
             FROM product_models pm
             JOIN models mo ON mo.models_id = pm.model_id
             JOIN brands br ON br.brands_id = mo.models_brands_id
             WHERE pm.product_id = ANY($1)
             ORDER BY br.brands_name, mo.models_name`,
                [ids],
            ),
            this.dataSource.query(
                `SELECT DISTINCT ON (l.product_id)
                    l.product_id AS "productId",
                    l.id AS "lotId", l.code AS "lotCode", l.created_at AS "lotCreatedAt",
                    l.unit_cost AS "lotUnitCost", l.sale_price AS "salePrice",
                    l.warranty_days AS "warrantyDays", l.has_tax AS "hasTax",
                    l.price_includes_tax AS "priceIncludesTax",
                    l.billable_in_sales AS "billableInSales",
                    l.billable_in_repair_orders AS "billableInRepairOrders",
                    rl.unit_cost AS "documentUnitCost", rl.discount AS "discount",
                    rl.purchase_tax_code AS "purchaseTaxCode", rl.purchase_tax_rate AS "purchaseTaxRate",
                    r.id AS "receiptId", r.code AS "receiptCode", r.issue_date AS "issueDate",
                    s.business_name AS "supplierName"
             FROM lots l
             JOIN receipt_lines rl ON rl.id = l.origin_id
             JOIN receipts r ON r.id = rl.receipt_id AND r.status <> 'VOIDED'
             LEFT JOIN suppliers s ON s.id = r.supplier_id
             WHERE l.company_id = $1
               AND l.origin_type = 'RECEIPT'
               AND l.product_id = ANY($2)
             ORDER BY l.product_id, l.created_at DESC, l.code DESC`,
                [companyId, ids],
            ),
        ]);

        const modelsByProduct = new Map<string, Array<{ id: number; name: string; brand: string }>>();
        for (const m of modelRows) {
            const list = modelsByProduct.get(m.productId) ?? [];
            list.push({ id: m.modelId, name: m.modelName, brand: m.brandName });
            modelsByProduct.set(m.productId, list);
        }
        const lastByProduct = new Map<string, any>(lastRows.map((r: any) => [r.productId, r]));

        return {
            items: rows.map((r) => {
                const last = lastByProduct.get(r.id);
                return {
                    id: r.id,
                    code: Number(r.code),
                    sku: r.sku,
                    upc: r.upc ?? null,
                    name: r.name,
                    kind: r.kind,
                    trackingMode: r.trackingMode,
                    typeCode: r.typeCode,
                    color: r.colorName ?? null,
                    quality: r.qualityName ?? null,
                    models: modelsByProduct.get(r.id) ?? [],
                    // Valores del producto: precargan la línea si nunca se ha ingresado
                    defaults: {
                        warrantyDays: Number(r.warrantyDays),
                        salePrice: r.basePrice,
                        hasTax: r.hasTax,
                        priceIncludesTax: r.priceIncludesTax,
                        billableInSales: r.billableInSales,
                        billableInRepairOrders: r.billableInRepairOrders,
                    },
                    // Referencia del último ingreso (null si nunca se ingresó)
                    lastReceipt: last
                        ? {
                            receiptId: last.receiptId,
                            receiptCode: Number(last.receiptCode),
                            issueDate: last.issueDate,
                            supplierName: last.supplierName ?? null,
                            lotId: last.lotId,
                            lotCode: Number(last.lotCode),
                            lotCreatedAt: last.lotCreatedAt,
                            unitCost: last.lotUnitCost,              // costo NETO del lote
                            documentUnitCost: last.documentUnitCost, // costo bruto según el documento
                            discount: last.discount,
                            purchaseTaxCode: last.purchaseTaxCode ?? null,
                            purchaseTaxRate: last.purchaseTaxRate ?? null,
                            salePrice: last.salePrice,
                            warrantyDays: Number(last.warrantyDays),
                            hasTax: last.hasTax,
                            priceIncludesTax: last.priceIncludesTax,
                            billableInSales: last.billableInSales,
                            billableInRepairOrders: last.billableInRepairOrders,
                        }
                        : null,
                };
            }),
        };
    }
}