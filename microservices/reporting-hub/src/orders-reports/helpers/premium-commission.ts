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
//
// Fórmula (P = priority_surcharge_percentage de la orden, ej. 15):
//   1. Total de la orden = suma(payments INGRESO) − suma(payments EGRESO)
//   2. Monto Premium     = total de la orden × P / 100
//   3. Monto a repartir  = monto Premium × P / 100      (P% del P%)
//   4. Comisión técnico  = monto a repartir / n.º de técnicos
//
// Ejemplo (P = 15, cobrado neto $100, 2 técnicos):
//   Premium = 100 × 0.15 = 15.00
//   Reparto = 15 × 0.15  = 2.25
//   Comisión por técnico = 2.25 / 2 = 1.125 → 1.13 (round2)
//
// • Técnicos: ids distintos con procedimientos activos QUE PERTENEZCAN al grupo
//   "TECHNICIANS". Quien realizó procedimientos pero no es técnico no cuenta
//   ni diluye el reparto. Si ningún ejecutor es técnico, la orden no genera
//   comisión. (da igual cuántos procedimientos hizo cada uno; partes iguales)
// • Se omite la orden si el total cobrado neto es <= 0 o si el técnico
//   consultado no es técnico válido en esa orden.
// • Fecha de referencia: primer evento ENTREGADA (8), igual que las comisiones
//   por entrega. Una orden reabierta y re-entregada cuenta con la primera.
// • Redondeo: la comisión se redondea por técnico, por lo que la suma de las
//   partes puede diferir en centavos de shareAmount.
// • El grupo se evalúa con el estado actual de user_employee_cache, no al
//   momento de la entrega.
// ═══════════════════════════════════════════════════════════════════════════

type Period = 'today' | 'week' | 'month';

export interface PremiumCommissionEntry {
    orderId: number;
    orderNumber: number;
    deviceTypeName: string;
    surchargePercentage: number;   // snapshot de la orden (15, 10, ...)
    baseAmount: number;            // total de la orden (pagos INGRESO − EGRESO)
    premiumAmount: number;         // baseAmount × %
    shareAmount: number;           // premiumAmount × % (monto a repartir entre técnicos)
    technicianCount: number;       // entre cuántos técnicos se divide
    commissionAmount: number;      // shareAmount / technicianCount (lo que le toca a este técnico)
    referenceDate: Date;
    referenceDateLabel: string;
}

export interface PremiumCommissionSummary {
    totalAmount: number;
    entries: PremiumCommissionEntry[];
}

export type PremiumCommissionPeriodSummary = Record<Period, PremiumCommissionSummary>;

const PREMIUM_PRIORITY_NAME = 'PREMIUM';
const TECHNICIAN_GROUP_NAME = 'TECHNICIANS';

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
    userModel: Model<any>,          // UserEmployeeCache
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

    // ── Resolver quiénes de los ejecutores pertenecen al grupo TECHNICIANS ──
    const performerIds = new Set<string>();
    for (const order of orders as any[]) {
        for (const f of order.findings ?? []) {
            if (f.is_active === false) continue;
            for (const p of f.procedures ?? []) {
                if (p.is_active === false) continue;
                if (p.performedBy?.id) performerIds.add(p.performedBy.id);
            }
        }
    }

    const technicianRows = performerIds.size
        ? await userModel
            .find({
                id: { $in: [...performerIds] },
                companyId,
                'groups.group_name': TECHNICIAN_GROUP_NAME,
            })
            .select('id')
            .lean()
        : [];
    const validTechnicians = new Set<string>(technicianRows.map((u: any) => u.id));

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

        // Técnicos distintos (solo del grupo TECHNICIANS) que realizaron procedimientos
        const technicianIds = new Set<string>(
            procedures
                .map((p) => p.performedBy?.id)
                .filter((id): id is string => !!id && validTechnicians.has(id)),
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
        const shareAmount = premiumAmount * (surchargePercentage / 100);
        const commissionAmount = round2(shareAmount / technicianIds.size);
        if (commissionAmount <= 0) continue;

        const entry: PremiumCommissionEntry = {
            orderId: order.id,
            orderNumber: order.order_number,
            deviceTypeName: order.device?.type?.name ?? '',
            surchargePercentage,
            baseAmount: round2(baseAmount),
            premiumAmount: round2(premiumAmount),
            shareAmount: round2(shareAmount),
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

export interface PremiumOrderResult {
    surchargePercentage: number;
    baseAmount: number;
    premiumAmount: number;
    shareAmount: number;
    technicianCount: number;
    perTechnician: { id: string; amount: number }[];
    referenceDate: Date;
}

/** null si la orden no genera comisión Premium. */
export function calcPremiumForOrder(order: any, validTechnicians: Set<string>): PremiumOrderResult | null {
    if (order.priority?.name !== PREMIUM_PRIORITY_NAME) return null;
    const pct = Number(order.priority_surcharge_percentage ?? 0);
    if (!(pct > 0)) return null;

    const delivered = (order.statusHistory ?? [])
        .filter((h: any) => h.toStatus?.id === ORDER_STATUS.ENTREGADA)
        .sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())[0];
    if (!delivered) return null;

    const ids = new Set<string>();
    for (const f of order.findings ?? []) {
        if (f.is_active === false) continue;
        for (const p of f.procedures ?? []) {
            if (p.is_active === false) continue;
            const id = p.performedBy?.id;
            if (id && validTechnicians.has(id)) ids.add(id);
        }
    }
    if (!ids.size) return null;

    const base = (order.payments ?? []).reduce((s: number, p: any) => {
        const a = Number(p.amount ?? 0);
        return p.flow_type === 'INGRESO' ? s + a : p.flow_type === 'EGRESO' ? s - a : s;
    }, 0);
    if (!(base > 0)) return null;

    const premium = base * (pct / 100);
    const share = premium * (pct / 100);
    const each = round2(share / ids.size);
    if (each <= 0) return null;

    return {
        surchargePercentage: pct,
        baseAmount: round2(base),
        premiumAmount: round2(premium),
        shareAmount: round2(share),
        technicianCount: ids.size,
        perTechnician: [...ids].map((id) => ({ id, amount: each })),
        referenceDate: new Date(delivered.changed_at),
    };
}
