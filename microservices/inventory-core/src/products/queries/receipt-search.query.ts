import { BadRequestException, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Brackets, DataSource, In } from 'typeorm';
import { Product } from '../entities/product.entity';
import { escapeLike, modelSearchSql, norm } from '../helpers/sql.helpers';
import { isNumericCode, tokenize } from '../helpers/text.helpers';
import { mapProductForReceipt, mapReceiptItems } from '../mappers/receipt-item.mapper';
import {
    ProductForReceipt,
    ReceiptProductItem,
    SearchProductsForReceiptQuery,
} from '../types/product-receipt.types';

@Injectable()
export class ReceiptSearchQuery {
    constructor(private readonly dataSource: DataSource) { }

    /**
     * Uso INTERNO (módulo de ingresos). Devuelve lo mínimo para armar una línea de ingreso:
     * identidad, kind, trackingMode, modelos y valores por defecto.
     * Falla si algún producto no existe, es de otra empresa o está inactivo.
     * No arrastra imágenes ni historial (a diferencia del detalle).
     */
    async findProducts(ids: string[], companyId: string): Promise<ProductForReceipt[]> {
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

        return rows.map(mapProductForReceipt);
    }

    /** Para otros módulos (SRI): items con la misma forma del buscador, por lista de ids. */
    async findItemsByIds(
        ids: string[],
        companyId: string,
        supplierId?: string,
    ): Promise<Map<string, ReceiptProductItem>> {
        const unique = [...new Set(ids)];
        if (!unique.length) return new Map();

        const rows = await this.baseQuery(companyId)
            .andWhere('p.id IN (:...ids)', { ids: unique })
            .getRawMany();
        const items = await this.toItems(rows, companyId, supplierId);

        return new Map(items.map((i) => [i.id, i] as [string, ReceiptProductItem]));
    }

    async search(query: SearchProductsForReceiptQuery, companyId: string) {
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
        const tokens = tokenize(query.search);

        const qb = this.baseQuery(companyId);

        if (query.kind) qb.andWhere('p.kind = :kind', { kind: query.kind });
        if (query.id) qb.andWhere('p.id = :id', { id: query.id });
        if (query.supplierId) qb.setParameter('supplierId', query.supplierId);

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

                    // Si se indica proveedor, el texto también busca por los códigos de ese proveedor
                    if (query.supplierId) {
                        w.orWhere(`EXISTS (
                            SELECT 1 FROM supplier_product_codes sc
                            WHERE sc.product_id = "p"."id"
                              AND sc.supplier_id = :supplierId
                              AND lower(sc.code) LIKE :${key}
                        )`);
                    }

                    // Un número entero también puede ser el código del producto
                    if (isNumericCode(token)) {
                        w.orWhere(`p.code = :${numKey}`);
                        params[numKey] = Number(token);
                    }
                }),
            );
            qb.setParameters(params);
        });

        // Si lo escrito es solo un número, el producto con ese código exacto va primero
        const onlyCode = tokens.length === 1 && isNumericCode(tokens[0]) ? Number(tokens[0]) : null;
        if (onlyCode !== null) {
            qb.addSelect('CASE WHEN p.code = :exactCode THEN 0 ELSE 1 END', 'rank')
                .setParameter('exactCode', onlyCode)
                .orderBy('rank', 'ASC')
                .addOrderBy('p.createdAt', 'DESC');
        } else {
            qb.orderBy('p.createdAt', 'DESC').addOrderBy('p.code', 'DESC');
        }

        const rows = await qb.limit(limit).getRawMany();
        return { items: await this.toItems(rows, companyId, query.supplierId) };
    }

    // ───────────────────────── Internos ─────────────────────────

    /** Consulta base de productos para el formulario de ingreso (activos de la empresa). */
    private baseQuery(companyId: string) {
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
    }

    /** Filas crudas → items del formulario (consulta modelos, último ingreso y códigos del proveedor). */
    private async toItems(rows: any[], companyId: string, supplierId?: string): Promise<ReceiptProductItem[]> {
        if (!rows.length) return [];
        const ids: string[] = rows.map((r) => r.id);

        const [modelRows, lastRows, codeRows] = await Promise.all([
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
                 WHERE l.company_id = $1 AND l.origin_type = 'RECEIPT' AND l.product_id = ANY($2)
                 ORDER BY l.product_id, l.created_at DESC, l.code DESC`,
                [companyId, ids],
            ),
            // Códigos que ese proveedor usa para estos productos (solo si se indicó proveedor)
            supplierId
                ? this.dataSource.query(
                    `SELECT product_id AS "productId", code, description, unit_factor AS "unitFactor"
                     FROM supplier_product_codes
                     WHERE company_id = $1 AND supplier_id = $2 AND product_id = ANY($3)`,
                    [companyId, supplierId, ids],
                )
                : Promise.resolve([] as any[]),
        ]);

        return mapReceiptItems(rows, { modelRows, lastRows, codeRows });
    }
}