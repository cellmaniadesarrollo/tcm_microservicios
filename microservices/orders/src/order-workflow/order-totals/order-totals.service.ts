// order-totals/order-totals.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SpareAssignment, SpareAssignmentStatus } from '../../spare-assignments/entities/spare-assignment.entity';
import { OrderPendingProduct } from '../../order-extras/entities/order-pending-product.entity';
import { OrderExtraService } from '../../order-extras/entities/order-extra-service.entity';
import { DiscountStatus, DiscountType } from '../../order-discounts/entities/order-discount.entity';


export interface OrderTotals {
    labor_total: number;
    spares_total: number;
    pending_products_total: number;
    extra_services_total: number;
    subtotal: number;
    surcharge_amount: number;
    total_order: number;
    discount_total: number;
    total_with_discount: number;
    total_paid: number;
    total_pending: number;
}

@Injectable()
export class OrderTotalsService {
    constructor(private readonly dataSource: DataSource) { }

    /** Suma por order_id → Map<orderId, number> */
    private async sumBy(
        qb: any,
        orderIds: number[],
    ): Promise<Map<number, number>> {
        const rows = await qb.getRawMany();
        return new Map(rows.map((r: any) => [Number(r.order_id), Number(r.total)]));
    }

    async computeForOrders(
        orders: any[], // deben traer: id, priority_surcharge_percentage, payments, discounts
    ): Promise<Map<number, OrderTotals>> {
        const ids = orders.map((o) => o.id);
        const result = new Map<number, OrderTotals>();
        if (!ids.length) return result;

        const [labor, spares, pending, extras] = await Promise.all([
            this.sumBy(
                this.dataSource
                    .createQueryBuilder()
                    .select('f.order_id', 'order_id')
                    .addSelect('COALESCE(SUM(p.procedure_cost), 0)', 'total')
                    .from('finding_procedures', 'p')
                    .innerJoin('order_findings', 'f', 'f.id = p.finding_id AND f.is_active = true')
                    .where('f.order_id IN (:...ids)', { ids })
                    .andWhere('p.is_active = true')
                    .groupBy('f.order_id'),
                ids,
            ),
            this.sumBy(
                this.dataSource
                    .getRepository(SpareAssignment)
                    .createQueryBuilder('s')
                    .select('s.order_id', 'order_id')
                    .addSelect('COALESCE(SUM(s.unit_price * s.quantity), 0)', 'total')
                    .where('s.order_id IN (:...ids)', { ids })
                    .andWhere('s.status = :st', { st: SpareAssignmentStatus.ACTIVE })
                    .groupBy('s.order_id'),
                ids,
            ),
            this.sumBy(
                this.dataSource
                    .getRepository(OrderPendingProduct)
                    .createQueryBuilder('pp')
                    .select('pp.order_id', 'order_id')
                    .addSelect('COALESCE(SUM(pp.sale_price * pp.quantity), 0)', 'total')
                    .where('pp.order_id IN (:...ids)', { ids })
                    .andWhere('pp.deletedAt IS NULL')
                    .groupBy('pp.order_id'),
                ids,
            ),
            this.sumBy(
                this.dataSource
                    .getRepository(OrderExtraService)
                    .createQueryBuilder('es')
                    .select('es.order_id', 'order_id')
                    .addSelect('COALESCE(SUM(es.total_price), 0)', 'total')
                    .where('es.order_id IN (:...ids)', { ids })
                    .andWhere('es.deletedAt IS NULL')
                    .groupBy('es.order_id'),
                ids,
            ),
        ]);

        for (const o of orders) {
            const labor_total = labor.get(o.id) ?? 0;
            const spares_total = spares.get(o.id) ?? 0;
            const pending_products_total = pending.get(o.id) ?? 0;
            const extra_services_total = extras.get(o.id) ?? 0;

            const subtotal = labor_total + spares_total + pending_products_total + extra_services_total;

            const pct = Number(o.priority_surcharge_percentage ?? 0);
            const surcharge_amount = Math.round(subtotal * pct) / 100; // igual que el front
            const total_order = subtotal + surcharge_amount;

            let discountRaw = 0;
            for (const d of o.discounts ?? []) {
                if (d.status === DiscountStatus.APPLIED) {
                    discountRaw += Number(d.calculated_amount ?? 0);
                } else if (d.status === DiscountStatus.PENDING) {
                    discountRaw +=
                        d.discount_type === DiscountType.FIXED
                            ? Number(d.discount_value)
                            : total_order * (Number(d.discount_value) / 100);
                }
            }
            const discount_total = Math.min(discountRaw, total_order);
            const total_with_discount = Math.max(0, total_order - discount_total);

            const total_paid = (o.payments ?? []).reduce(
                (acc: number, p: any) => acc + Number(p.amount ?? 0), 0);

            result.set(o.id, {
                labor_total, spares_total, pending_products_total, extra_services_total,
                subtotal, surcharge_amount, total_order,
                discount_total, total_with_discount,
                total_paid,
                total_pending: Math.max(0, total_with_discount - total_paid),
            });
        }
        return result;
    }

    async appendTotals<T extends { id: number }>(orders: T[]): Promise<(T & { totals: OrderTotals })[]> {
        const map = await this.computeForOrders(orders);
        return orders.map((o) => ({ ...o, totals: map.get(o.id)! }));
    }
}