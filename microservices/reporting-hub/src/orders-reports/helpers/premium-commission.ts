import { Model } from 'mongoose';
import { gueRanges, ORDER_STATUS } from './commission.helper';
// Ajusta estos imports a tu proyecto:
// import { gueRanges } from '...';
// import { ORDER_STATUS } from '...';

// ═══════════════════════════════════════════════════════════════════════════
// Comisión PREMIUM
// ───────────────────────────────────────────────────────────────────────────
// • Independiente de employeeCommissionModel: se define en la propia orden.
// • Aplica a órdenes con priority.name === 'PREMIUM' y recargo congelado > 0.
// • Total de la orden = suma(payments INGRESO) − suma(payments EGRESO)
// • Monto Premium de la orden = total de la orden
//                               × priority_surcharge_percentage / 100
// • Se divide en partes iguales entre los técnicos distintos que realizaron
//   procedimientos activos (da igual cuántos hizo cada uno).
// • Fecha de referencia: primer evento ENTREGADA (8), igual que las comisiones
//   por entrega.
// ═══════════════════════════════════════════════════════════════════════════

type Period = 'today' | 'week' | 'month';

export interface PremiumCommissionEntry {
    orderId: number;
    orderNumber: number;
    deviceTypeName: string;
    surchargePercentage: number;   // snapshot de la orden (15, 10, ...)
    baseAmount: number;            // total de la orden (pagos INGRESO − EGRESO)
    premiumAmount: number;         // baseAmount × % (monto Premium de la orden)
    technicianCount: number;       // entre cuántos se divide
    commissionAmount: number;      // lo que le toca a este técnico
    referenceDate: Date;
    referenceDateLabel: string;
}

export interface PremiumCommissionSummary {
    totalAmount: number;
    entries: PremiumCommissionEntry[];
}

export type PremiumCommissionPeriodSummary = Record<Period, PremiumCommissionSummary>;

const PREMIUM_PRIORITY_NAME = 'PREMIUM';

const PREMIUM_PROJECTION = {
    id: 1,
    order_number: 1,
    priority: 1,
    priority_surcharge_percentage: 1,
    'device.type.name': 1,
    'statusHistory.toStatus.id': 1,
    'statusHistory.changed_at': 1,
    'findings.is_active': 1,
    'findings.procedures.is_active': 1,
    'findings.procedures.performedBy.id': 1,
    'payments.flow_type': 1,
    'payments.amount': 1,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getPremiumCommissions(
    orderModel: Model<any>,
    companyId: string,
    userId: string,
    now: Date = new Date(),
): Promise<PremiumCommissionPeriodSummary> {
    const ranges = gueRanges(now) as Record<Period, Date>;

    // Una sola query desde el inicio más antiguo de los tres períodos;
    // luego se reparte en today / week / month según la fecha de entrega.
    const since = new Date(
        Math.min(ranges.today.getTime(), ranges.week.getTime(), ranges.month.getTime()),
    );

    const orders = await orderModel
        .find(
            {
                'company.id': companyId,
                'priority.name': PREMIUM_PRIORITY_NAME,
                priority_surcharge_percentage: { $gt: 0 },
                'findings.procedures.performedBy.id': userId,
                statusHistory: {
                    $elemMatch: {
                        'toStatus.id': ORDER_STATUS.ENTREGADA,
                        changed_at: { $gte: since },
                    },
                },
            },
            PREMIUM_PROJECTION,
        )
        .lean();

    const periodEntries: Record<Period, PremiumCommissionEntry[]> = {
        today: [],
        week: [],
        month: [],
    };

    for (const order of orders as any[]) {
        const surchargePercentage = Number(order.priority_surcharge_percentage ?? 0);
        if (!(surchargePercentage > 0)) continue;

        // Primer evento ENTREGADA
        const deliveredEvent = (order.statusHistory ?? [])
            .filter((h: any) => h.toStatus?.id === ORDER_STATUS.ENTREGADA)
            .sort(
                (a: any, b: any) =>
                    new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
            )[0];
        if (!deliveredEvent) continue;
        const referenceDate = new Date(deliveredEvent.changed_at);

        // Solo findings y procedimientos activos
        const procedures: any[] = (order.findings ?? [])
            .filter((f: any) => f.is_active !== false)
            .flatMap((f: any) => (f.procedures ?? []).filter((p: any) => p.is_active !== false));

        // Técnicos distintos que realizaron procedimientos
        const technicianIds = new Set<string>(
            procedures.map((p) => p.performedBy?.id).filter(Boolean),
        );
        if (!technicianIds.has(userId)) continue;

        // Total de la orden = pagos INGRESO − pagos EGRESO (devoluciones)
        const baseAmount = (order.payments ?? []).reduce((sum: number, p: any) => {
            const amount = Number(p.amount ?? 0);
            if (p.flow_type === 'INGRESO') return sum + amount;
            if (p.flow_type === 'EGRESO') return sum - amount;
            return sum;
        }, 0);
        if (!(baseAmount > 0)) continue;

        const premiumAmount = baseAmount * (surchargePercentage / 100);
        const commissionAmount = round2(premiumAmount / technicianIds.size);
        if (commissionAmount <= 0) continue;

        const entry: PremiumCommissionEntry = {
            orderId: order.id,
            orderNumber: order.order_number,
            deviceTypeName: order.device?.type?.name ?? '',
            surchargePercentage,
            baseAmount: round2(baseAmount),
            premiumAmount: round2(premiumAmount),
            technicianCount: technicianIds.size,
            commissionAmount,
            referenceDate,
            referenceDateLabel: 'Fecha entrega',
        };

        for (const period of ['today', 'week', 'month'] as Period[]) {
            if (referenceDate >= ranges[period]) periodEntries[period].push(entry);
        }
    }

    const summarize = (entries: PremiumCommissionEntry[]): PremiumCommissionSummary => ({
        totalAmount: round2(entries.reduce((s, e) => s + e.commissionAmount, 0)),
        entries,
    });

    return {
        today: summarize(periodEntries.today),
        week: summarize(periodEntries.week),
        month: summarize(periodEntries.month),
    };
}