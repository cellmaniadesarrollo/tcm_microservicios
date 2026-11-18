import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Brackets, DataSource } from 'typeorm';
import { UnitStatus } from '../../stock/enums/stock.enums';
import { Product } from '../entities/product.entity';
import { escapeLike, modelSearchSql, norm } from '../helpers/sql.helpers';
import { isNumericCode, tokenize } from '../helpers/text.helpers';
import { ProductImagesService } from '../images/product-images.service';

const MAX_QUERY = 100;
const MAX_PRODUCTS = 20;
const IMEI_RE = /^\d{15}$/;

const bad = (m: string) => new RpcException(new BadRequestException(m));
const notFound = (m: string) => new RpcException(new NotFoundException(m));
const conflict = (m: string) => new RpcException(new ConflictException(m));

interface BuildOpts { lotCode?: number; lotId?: string; unitId?: string }

/**
 * Buscador de productos para ventas. Solo devuelve lo que tiene stock disponible
 * EN LA SUCURSAL del usuario (lotes y unidades de esa sucursal).
 *
 * Detección (en este orden):
 *  1. lotCode (solo lector)  -> SKU exacto + lote exacto
 *  2. 15 dígitos             -> IMEI (producto + lote + unidad)
 *  3. "#texto"               -> UPC exacto (puede devolver varios)
 *  4. coincide con un SKU    -> SKU exacto (todos sus lotes con stock)
 *  5. lector sin coincidencia-> error "no existe"
 *  6. resto                  -> búsqueda por palabras (AND entre palabras, OR entre campos)
 *
 * No devuelve unitCost. billableInSales es informativo: la decisión de facturar es de billing.
 */
@Injectable()
export class SaleSearchQuery {
    constructor(
        private readonly dataSource: DataSource,
        private readonly images: ProductImagesService,
    ) { }

    async search(companyId: string, branchId: string, raw: any) {
        const q = String(raw?.q ?? '').trim();
        if (!q) throw bad('Escribe qué buscar');
        if (q.length > MAX_QUERY) throw bad(`La búsqueda no puede superar ${MAX_QUERY} caracteres`);

        if (raw?.source != null && raw.source !== 'SCANNER' && raw.source !== 'MANUAL') {
            throw bad('El origen de la búsqueda no es válido');
        }
        const source: 'SCANNER' | 'MANUAL' = raw?.source === 'SCANNER' ? 'SCANNER' : 'MANUAL';

        let lotCode: number | undefined;
        if (raw?.lotCode != null && raw.lotCode !== '') {
            lotCode = Number(raw.lotCode);
            if (!Number.isInteger(lotCode) || lotCode <= 0) throw bad('El lote no es válido');
            if (source !== 'SCANNER') throw bad('El lote solo se envía desde el lector');
        }

        // 1. Lector: SKU + lote
        if (lotCode !== undefined) return this.bySku(companyId, branchId, q, lotCode);

        // 2. IMEI
        if (IMEI_RE.test(q)) return this.byImei(companyId, branchId, q);

        // 3. UPC
        if (q.startsWith('#')) return this.byUpc(companyId, branchId, q.slice(1).trim());

        // 4. SKU exacto (escrito o pegado)
        if (await this.findProductIdBySku(companyId, q)) return this.bySku(companyId, branchId, q);

        // 5. Lector sin coincidencia: no tiene sentido buscar por texto
        if (source === 'SCANNER') throw notFound('El producto no existe');

        // 6. Texto libre
        return this.byText(companyId, branchId, q);
    }

    // ───────────────────────── Modos ─────────────────────────

    private async bySku(companyId: string, branchId: string, sku: string, lotCode?: number) {
        const productId = await this.findProductIdBySku(companyId, sku);
        if (!productId) throw notFound('El producto no existe');

        if (lotCode !== undefined) {
            const lot: Array<{ product_id: string }> = await this.dataSource.query(
                `SELECT product_id FROM lots WHERE company_id = $1 AND code = $2`,
                [companyId, lotCode],
            );
            if (!lot[0] || lot[0].product_id !== productId) throw bad('El lote no corresponde al producto');
        }

        const items = await this.buildItems(companyId, branchId, [productId], { lotCode });
        if (!items.length) {
            throw conflict(
                lotCode !== undefined
                    ? `El lote #${lotCode} no tiene stock en esta sucursal`
                    : 'El producto no tiene stock en esta sucursal',
            );
        }
        return items;
    }

    private async byImei(companyId: string, branchId: string, imei: string) {
        const rows: Array<{ unitId: string; status: string; lotId: string; productId: string; branchId: string }> =
            await this.dataSource.query(
                `SELECT u.id AS "unitId", u.status, u.lot_id AS "lotId",
                        u.product_id AS "productId", u.branch_id AS "branchId"
                   FROM stock_unit_serials s
                   JOIN stock_units u ON u.id = s.unit_id
                  WHERE s.company_id = $1 AND s.value = $2`,
                [companyId, imei],
            );
        if (!rows.length) throw notFound('No existe ninguna unidad con ese IMEI');

        const ok = rows.find((r) => r.branchId === branchId && r.status === UnitStatus.AVAILABLE);
        if (!ok) throw conflict(this.unitUnavailableMessage(rows[0], branchId));

        const items = await this.buildItems(companyId, branchId, [ok.productId], {
            lotId: ok.lotId,
            unitId: ok.unitId,
        });
        if (!items.length) throw conflict('El lote de ese IMEI no tiene stock disponible en esta sucursal');
        return items;
    }

    private async byUpc(companyId: string, branchId: string, upc: string) {
        if (!upc) throw bad('Escribe el código de barras después del #');

        const rows: Array<{ id: string }> = await this.dataSource.query(
            `SELECT id FROM products
              WHERE company_id = $1 AND status = true AND lower(upc) = lower($2)
              ORDER BY code
              LIMIT ${MAX_PRODUCTS}`,
            [companyId, upc],
        );
        if (!rows.length) throw notFound('No existe un producto con ese código de barras');

        const items = await this.buildItems(companyId, branchId, rows.map((r) => r.id));
        if (!items.length) throw conflict('El producto no tiene stock en esta sucursal');
        return items;
    }

    private async byText(companyId: string, branchId: string, text: string) {
        const tokens = tokenize(text);
        if (!tokens.length) throw bad('Escribe qué buscar');

        const qb = this.dataSource
            .createQueryBuilder(Product, 'p')
            .innerJoin('p.productName', 'pn')
            .innerJoin('p.productType', 'pt')
            .leftJoin('p.color', 'co')
            .leftJoin('p.quality', 'qu')
            .select('p.id', 'id')
            .where('p.companyId = :companyId', { companyId })
            .andWhere('p.status = true')
            // Solo productos con stock disponible en la sucursal del usuario
            .andWhere(
                `EXISTS (SELECT 1 FROM stock_balances sb
                          WHERE sb.product_id = "p"."id" AND sb.branch_id = :branchId
                            AND sb.on_hand - sb.reserved > 0)`,
                { branchId },
            );

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
                    if (isNumericCode(token)) w.orWhere(`p.code = :n${i}`, { [`n${i}`]: Number(token) });
                }),
            );
            qb.setParameter(key, `%${escapeLike(token)}%`);
        });

        const ids = (await qb.orderBy('pn.name', 'ASC').addOrderBy('p.code', 'ASC').limit(MAX_PRODUCTS).getRawMany())
            .map((r) => r.id as string);

        return this.buildItems(companyId, branchId, ids);
    }

    // ───────────────────────── Armado de resultados ─────────────────────────

    private async findProductIdBySku(companyId: string, sku: string): Promise<string | null> {
        const rows: Array<{ id: string }> = await this.dataSource.query(
            `SELECT id FROM products WHERE company_id = $1 AND status = true AND lower(sku) = lower($2) LIMIT 1`,
            [companyId, sku],
        );
        return rows[0]?.id ?? null;
    }

    /** Productos con lotes (y unidades) disponibles en la sucursal. Los que no tienen stock no aparecen. */
    private async buildItems(companyId: string, branchId: string, productIds: string[], opts: BuildOpts = {}) {
        if (!productIds.length) return [];

        // Lotes con stock disponible en la sucursal
        const params: unknown[] = [companyId, branchId, productIds];
        let extra = '';
        if (opts.lotCode !== undefined) { params.push(opts.lotCode); extra += ` AND l.code = $${params.length}`; }
        if (opts.lotId) { params.push(opts.lotId); extra += ` AND l.id = $${params.length}`; }

        const lotRows: any[] = await this.dataSource.query(
            `SELECT l.id AS "lotId", l.product_id AS "productId", l.code,
                    b.on_hand AS "onHand", b.reserved,
                    (b.on_hand - b.reserved) AS "available",
                    l.sale_price AS "salePrice", l.warranty_days AS "warrantyDays",
                    l.has_tax AS "hasTax", l.price_includes_tax AS "priceIncludesTax",
                    l.billable_in_sales AS "billableInSales",
                    l.billable_in_repair_orders AS "billableInRepairOrders",
                    l.created_at AS "createdAt"
               FROM stock_balances b
               JOIN lots l ON l.id = b.lot_id
              WHERE b.company_id = $1 AND b.branch_id = $2 AND b.product_id = ANY($3)
                AND b.on_hand - b.reserved > 0${extra}
              ORDER BY l.created_at ASC, l.code ASC`,
            params,
        );
        if (!lotRows.length) return [];

        const withStock = [...new Set(lotRows.map((r) => r.productId as string))];
        const lotIds = lotRows.map((r) => r.lotId as string);

        const [products, modelRows, imageUrls, unitRows] = await Promise.all([
            this.loadProducts(companyId, withStock),
            this.dataSource.query(
                `SELECT pm.product_id AS "productId", mo.models_id AS "modelId",
                        mo.models_name AS "modelName", br.brands_name AS "brandName"
                   FROM product_models pm
                   JOIN models mo ON mo.models_id = pm.model_id
                   JOIN brands br ON br.brands_id = mo.models_brands_id
                  WHERE pm.product_id = ANY($1)
                  ORDER BY br.brands_name, mo.models_name`,
                [withStock],
            ) as Promise<any[]>,
            this.images.primaryImageUrls(withStock),
            this.dataSource.query(
                `SELECT u.id AS "unitId", u.lot_id AS "lotId", u.serial
                   FROM stock_units u
                  WHERE u.company_id = $1 AND u.branch_id = $2 AND u.status = $3
                    AND u.lot_id = ANY($4)${opts.unitId ? ' AND u.id = $5' : ''}
                  ORDER BY u.serial ASC`,
                opts.unitId
                    ? [companyId, branchId, UnitStatus.AVAILABLE, lotIds, opts.unitId]
                    : [companyId, branchId, UnitStatus.AVAILABLE, lotIds],
            ) as Promise<any[]>,
        ]);

        const modelIds = [...new Set(modelRows.map((m) => m.modelId as number))];
        const unitIds = unitRows.map((u) => u.unitId as string);

        const [techRows, serialRows] = await Promise.all([
            modelIds.length
                ? (this.dataSource.query(
                    `SELECT mtc_models_id AS "modelId", mtc_code AS "code"
                       FROM model_technical_codes WHERE mtc_models_id = ANY($1) ORDER BY mtc_code`,
                    [modelIds],
                ) as Promise<any[]>)
                : Promise.resolve([] as any[]),
            unitIds.length
                ? (this.dataSource.query(
                    `SELECT unit_id AS "unitId", value FROM stock_unit_serials
                      WHERE unit_id = ANY($1) ORDER BY position ASC`,
                    [unitIds],
                ) as Promise<any[]>)
                : Promise.resolve([] as any[]),
        ]);

        const group = <T>(arr: T[], key: (x: T) => string) => {
            const m = new Map<string, T[]>();
            for (const x of arr) { const k = key(x); const l = m.get(k) ?? []; l.push(x); m.set(k, l); }
            return m;
        };
        const techByModel = group(techRows, (t) => String(t.modelId));
        const modelsByProduct = group(modelRows, (m) => m.productId);
        const serialsByUnit = group(serialRows, (s) => s.unitId);
        const unitsByLot = group(unitRows, (u) => u.lotId);
        const lotsByProduct = group(lotRows, (l) => l.productId);

        const productById = new Map(products.map((p) => [p.id as string, p] as [string, any]));

        return withStock
            .filter((id) => productById.has(id)) // por si el producto se desactivó entre consultas
            .map((id) => {
                const p = productById.get(id)!;
                const lots = (lotsByProduct.get(id) ?? []).map((l) => ({
                    lotId: l.lotId as string,
                    code: Number(l.code),
                    onHand: Number(l.onHand),
                    reserved: Number(l.reserved),
                    available: Number(l.available),
                    salePrice: l.salePrice as string,
                    warrantyDays: Number(l.warrantyDays),
                    hasTax: l.hasTax as boolean,
                    priceIncludesTax: l.priceIncludesTax as boolean,
                    billableInSales: l.billableInSales as boolean,
                    billableInRepairOrders: l.billableInRepairOrders as boolean,
                    createdAt: l.createdAt as Date,
                    units: (unitsByLot.get(l.lotId) ?? []).map((u) => ({
                        unitId: u.unitId as string,
                        serial: u.serial as string,
                        serials: (serialsByUnit.get(u.unitId) ?? []).map((s) => s.value as string),
                    })),
                }));

                const models = (modelsByProduct.get(id) ?? []).map((m) => ({
                    id: m.modelId as number,
                    name: m.modelName as string,
                    brand: m.brandName as string,
                    technicalCodes: (techByModel.get(String(m.modelId)) ?? []).map((t) => t.code as string),
                }));

                return {
                    product: {
                        id,
                        code: Number(p.code),
                        sku: p.sku as string,
                        upc: (p.upc as string) ?? null,
                        name: p.name as string,
                        description: (p.description as string) ?? null,
                        kind: p.kind,
                        trackingMode: p.trackingMode,
                        typeName: (p.typeName as string) ?? null,
                        colorName: (p.colorName as string) ?? null,
                        qualityName: (p.qualityName as string) ?? null,
                        brands: [...new Set(models.map((m) => m.brand))],
                        models,
                        imageUrl: imageUrls.get(id) ?? null,
                    },
                    stock: {
                        onHand: lots.reduce((s, l) => s + l.onHand, 0),
                        available: lots.reduce((s, l) => s + l.available, 0),
                    },
                    lots,
                };
            });
    }

    private loadProducts(companyId: string, ids: string[]) {
        return this.dataSource
            .createQueryBuilder(Product, 'p')
            .innerJoin('p.productName', 'pn')
            .innerJoin('p.productType', 'pt')
            .leftJoin('p.color', 'co')
            .leftJoin('p.quality', 'qu')
            .select('p.id', 'id')
            .addSelect('p.code', 'code')
            .addSelect('p.sku', 'sku')
            .addSelect('p.upc', 'upc')
            .addSelect('p.description', 'description')
            .addSelect('p.kind', 'kind')
            .addSelect('p.trackingMode', 'trackingMode')
            .addSelect('pn.name', 'name')
            .addSelect('pt.name', 'typeName')
            .addSelect('co.name', 'colorName')
            .addSelect('qu.name', 'qualityName')
            .where('p.companyId = :companyId', { companyId })
            .andWhere('p.status = true')
            .andWhere('p.id IN (:...ids)', { ids })
            .getRawMany();
    }

    private unitUnavailableMessage(unit: { status: string; branchId: string }, branchId: string): string {
        if (unit.branchId !== branchId) return 'Ese IMEI está en otra sucursal';
        switch (unit.status) {
            case UnitStatus.SOLD: return 'Ese IMEI ya fue vendido';
            case UnitStatus.ISSUED: return 'Ese IMEI está fuera de bodega (salida manual pendiente de retorno)';
            case UnitStatus.CONSUMED: return 'Ese IMEI fue consumido en una orden de reparación';
            case UnitStatus.RESERVED: return 'Ese IMEI está reservado';
            default: return `Ese IMEI no está disponible (estado ${unit.status})`;
        }
    }
}