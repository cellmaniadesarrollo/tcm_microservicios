import { Injectable, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DataSource, In } from 'typeorm';
import { StockUnitSerial } from '../../stock/entities/stock-unit-serial.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
    DETAIL_MAX_LOTS,
    DETAIL_MAX_MOVEMENTS,
    DETAIL_MAX_UNITS,
} from '../constants/product.constants';
import { Product } from '../entities/product.entity';
import { TrackingMode } from '../enums/product.enums';
import { truncate } from '../helpers/group.helpers';
import { ProductImagesService } from '../images/product-images.service';
import { ProductDetailData } from '../mappers/product-detail.mapper';

@Injectable()
export class ProductDetailQuery {
    constructor(
        private readonly dataSource: DataSource,
        private readonly images: ProductImagesService,
        private readonly audit: AuditLogService,
    ) { }

    /** Carga todo lo necesario para el detalle (el armado de la respuesta lo hace el mapper). */
    async load(id: string, companyId: string): Promise<ProductDetailData> {
        const product = await this.dataSource.getRepository(Product).findOne({
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
        if (!product) throw new RpcException(new NotFoundException('El producto no existe'));

        const isSerial = product.trackingMode === TrackingMode.SERIAL;

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

        // IMEI de los equipos que se van a mostrar
        const shownUnits = truncate(unitRows, DETAIL_MAX_UNITS).items;
        const serialRows = shownUnits.length
            ? await this.dataSource.getRepository(StockUnitSerial).find({
                where: { unitId: In(shownUnits.map((u: any) => u.id)) },
                order: { position: 'ASC' },
            })
            : [];

        return {
            product,
            images,
            history,
            totalsRow: totalsRows[0],
            lotRows,
            unitCounts,
            unitRows,
            serialRows,
            movementRows,
        };
    }
}