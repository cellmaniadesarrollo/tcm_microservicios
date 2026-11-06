import { BadRequestException, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Brackets, DataSource, In } from 'typeorm';
import { ProductKind } from '../../common/enums/product-kind.enum';
import { ProductType } from '../../product-catalogs/entities/product-type.entity';
import { Quality } from '../../product-catalogs/entities/quality.entity';
import { ProductUsage } from '../../product-catalogs/entities/product-usage.entity';
import {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    SORT_COLUMNS,
    STOCK_STATUS_LABELS,
} from '../constants/product.constants';
import { Product } from '../entities/product.entity';
import { ProductModel } from '../entities/product-model.entity';
import { ProductUsageLink } from '../entities/product-usage-link.entity';
import { TrackingMode } from '../enums/product.enums';
import { AVAILABLE_SQL, escapeLike, modelSearchSql, norm } from '../helpers/sql.helpers';
import { isNumericCode, tokenize } from '../helpers/text.helpers';
import { ProductImagesService } from '../images/product-images.service';
import { ProductListExtras } from '../mappers/product-list.mapper';
import { ListProductsQuery, ProductSortBy, StockStatus } from '../types/product-list.types';

type ProductQB = ReturnType<ReturnType<DataSource['getRepository']>['createQueryBuilder']>;

@Injectable()
export class ProductListQuery {
    constructor(
        private readonly dataSource: DataSource,
        private readonly images: ProductImagesService,
    ) { }

    /** Página de productos (con filtros, búsqueda y orden) más el total. */
    async findPage(query: ListProductsQuery, companyId: string) {
        const bad400 = (m: string) => new RpcException(new BadRequestException(m));

        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));

        if (query.stockStatus && !['OUT', 'LOW', 'OK'].includes(query.stockStatus)) {
            throw bad400('El estado de stock no es válido');
        }
        if (query.trackingMode && !Object.values(TrackingMode).includes(query.trackingMode)) {
            throw bad400('El modo de seguimiento no es válido');
        }

        const qb = this.baseQuery(companyId);
        this.applySearch(qb, query.search);
        this.applyFilters(qb, query);

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

        return { rows, total, page, limit };
    }

    /** Datos de la página: modelos, usos, imagen, stock y último lote. */
    async loadExtras(rows: Product[], companyId: string): Promise<ProductListExtras> {
        const ids = rows.map((r) => r.id);

        const [links, usageLinks, imageUrls, stockRows, lastLotRows] = await Promise.all([
            ids.length
                ? this.dataSource.getRepository(ProductModel).find({
                    where: { productId: In(ids) },
                    relations: { model: { brand: true } },
                })
                : Promise.resolve([] as ProductModel[]),
            ids.length
                ? this.dataSource.getRepository(ProductUsageLink).find({
                    where: { productId: In(ids) },
                    relations: { usage: true },
                })
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

        return { links, usageLinks, imageUrls, stockRows, lastLotRows };
    }

    /** Opciones completas de filtros y orden (se envían con `includeFilters`). */
    async buildFilters(companyId: string) {
        const em = this.dataSource.manager;
        const [types, qualities, usages] = await Promise.all([
            em.find(ProductType, {
                where: { companyId, status: true },
                select: { id: true, name: true, code: true, kind: true },
                order: { name: 'ASC' },
            }),
            em.find(Quality, {
                where: { companyId, status: true },
                select: { id: true, name: true },
                order: { name: 'ASC' },
            }),
            em.find(ProductUsage, {
                where: { companyId, status: true },
                select: { id: true, code: true, name: true, area: true },
                order: { name: 'ASC' },
            }),
        ]);

        return {
            kinds: Object.values(ProductKind).map((value) => ({
                value,
                label: { DEVICE: 'Equipo', PART: 'Repuesto', ACCESSORY: 'Accesorio' }[value],
            })),
            trackingModes: [
                { value: TrackingMode.QUANTITY, label: 'Por cantidad' },
                { value: TrackingMode.SERIAL, label: 'Por serial/IMEI' },
            ],
            stockStatuses: (Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map((value) => ({
                value,
                label: STOCK_STATUS_LABELS[value],
            })),
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

    // ───────────────────────── Internos ─────────────────────────

    private baseQuery(companyId: string) {
        return this.dataSource
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
    }

    /**
     * Cada palabra debe coincidir (AND) con alguno de estos campos (OR):
     * nombre, tipo, SKU, UPC, color, calidad, o marca / modelo / código técnico de un modelo compatible.
     */
    private applySearch(qb: ProductQB, search?: string) {
        tokenize(search).forEach((token, i) => {
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
                    if (isNumericCode(token)) w.orWhere(`p.code = :n${i}`, { [`n${i}`]: Number(token) });
                }),
            );
            qb.setParameter(key, `%${escapeLike(token)}%`);
        });
    }

    private applyFilters(qb: ProductQB, query: ListProductsQuery) {
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
    }
}