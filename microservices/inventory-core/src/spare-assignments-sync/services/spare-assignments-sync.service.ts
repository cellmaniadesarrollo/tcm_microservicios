import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // el upsert es idempotente: pedir de más no daña

@Injectable()
export class SpareAssignmentsSyncService {
    constructor(private readonly dataSource: DataSource) { }

    /**
     * Una fila por línea de salida con orden, con la misma forma que el bulk del legacy.
     * Estado: returned si no queda saldo; cancellation_requested si hay solicitud PENDING;
     * si no, active. `quantity` sigue la misma regla que los eventos: lo que falta por devolver,
     * y en un retorno total, la cantidad del último retorno (la última cantidad activa).
     */
    async findForSync(fromCache?: string | null) {
        let from: Date | null = null;
        if (fromCache) {
            const d = new Date(fromCache);
            if (!Number.isNaN(d.getTime())) from = new Date(d.getTime() - SAFETY_MARGIN_MS);
        }

        const rows: any[] = await this.dataSource.query(
            `SELECT * FROM (
                SELECT l.id,
                       v.order_id                               AS "orderId",
                       l.quantity,
                       p.sku,
                       COALESCE(pn.name, p.sku)                 AS "productName",
                       l.sale_price                             AS "salePrice",
                       lot.code                                 AS "batchNumber",
                       l.billable_in_repair_orders              AS "billable",
                       v.created_at                             AS "createdAt",
                       COALESCE(r.returned, 0)::int             AS "returned",
                       r.last_qty                               AS "lastReturnQty",
                       r.last_at                                AS "lastReturnAt",
                       EXISTS (SELECT 1 FROM spare_cancellation_requests c
                                WHERE c.movement_id = l.id::text AND c.status = 'PENDING') AS "cancelPending",
                       GREATEST(
                           v.created_at,
                           r.last_at,
                           (SELECT MAX(c.updated_at) FROM spare_cancellation_requests c WHERE c.movement_id = l.id::text)
                       )                                        AS "updatedAt"
                  FROM stock_voucher_lines l
                  JOIN stock_vouchers v   ON v.id = l.voucher_id
                  JOIN products p         ON p.id = l.product_id
                  LEFT JOIN product_names pn ON pn.id = p.product_name_id
                  JOIN lots lot           ON lot.id = l.lot_id
                  LEFT JOIN LATERAL (
                        SELECT SUM(rl.quantity)::int AS returned,
                               (array_agg(rl.quantity ORDER BY rv.created_at DESC, rl.id DESC))[1] AS last_qty,
                               MAX(rv.created_at) AS last_at
                          FROM stock_voucher_lines rl
                          JOIN stock_vouchers rv ON rv.id = rl.voucher_id
                         WHERE rl.origin_line_id = l.id) r ON true
                 WHERE v.direction = 'OUT' AND v.order_id IS NOT NULL
             ) t
             WHERE ($1::timestamptz IS NULL OR t."updatedAt" > $1::timestamptz)
             ORDER BY t."updatedAt" ASC`,
            [from],
        );

        return rows.map((r) => {
            const remaining = Number(r.quantity) - Number(r.returned);
            const isReturned = remaining <= 0;
            const status = isReturned ? 'returned' : r.cancelPending ? 'cancellation_requested' : 'active';
            return {
                id: r.id,
                movementId: r.id,
                orderId: Number(r.orderId),
                quantity: isReturned ? Number(r.lastReturnQty ?? r.quantity) : remaining,
                spare: {
                    sku: r.sku,
                    productName: r.productName,
                    unitPrice: Number(r.salePrice),
                    batchNumber: Number(r.batchNumber),
                    isBillableInRepairOrders: !!r.billable,
                },
                status,
                returnedAt: isReturned ? r.lastReturnAt : null,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                origin: 'inventory-core',
            };
        });
    }
}