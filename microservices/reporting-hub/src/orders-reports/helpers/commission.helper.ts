// helpers/commission.helper.ts
// ─────────────────────────────────────────────────────────────────────────────
// Calcula comisiones de un técnico cruzando sus órdenes (OrderReplica)
// con sus reglas de comisión (EmployeeCommission).
//
// Reglas de negocio:
//  • Solo se procesan órdenes que tengan en statusHistory al menos un evento
//    con toStatus.id === 7 (TRABAJO_FINALIZADO).
//  • La fecha de referencia es changed_at del PRIMER evento toStatus.id === 7
//    en statusHistory, interpretada en zona horaria America/Guayaquil (UTC-5).
//
//  ── commissionType === 'device_category' ────────────────────────────────────
//  • targetId === order.device.type.name
//  • Se aplica POR PROCEDIMIENTO donde performedBy.id === userId y cost > 0.
//  • valueType === 'percentage' → amount = procedure_cost * (value / 100)
//  • valueType === 'fixed'     → amount = value
//
//  ── commissionType === 'branch' ─────────────────────────────────────────────
//  • targetId === order.branch.name
//  • Se aplica UNA VEZ POR ORDEN como una entry especial (procedureId = 0).
//  • Condición: el técnico realizó al menos un procedimiento en la orden.
//  • valueType === 'fixed'     → amount = value  (ej: $1 por orden)
//  • valueType === 'percentage'→ amount = suma(procedure_cost técnico) * (value/100)
// ─────────────────────────────────────────────────────────────────────────────

import { OrderReplica } from "../../orders-relay/schemas/order-replica.schema";
import { Commission } from "../../users-employees-events/schemas/employee-commission.schema";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIMEZONE = 'America/Guayaquil'; // UTC-5, sin DST
const FINALIZED_STATUS_ID = 7;        // TRABAJO_FINALIZADO

// ── Tipos de retorno (estructura original sin cambios) ────────────────────────

export interface CommissionEntry {
    orderId: number;
    orderNumber: number;
    deviceTypeName: string;
    procedureId: number;           // 0 = entry de comisión por sucursal
    procedureDescription: string;  // 'Comisión por sucursal: <nombre>' cuando es branch
    procedureCost: number;
    commissionRate: number;        // valor configurado (% o monto fijo)
    commissionValueType: string;   // 'percentage' | 'fixed'
    commissionAmount: number;      // monto calculado final
    finalizedAt: Date;             // changed_at del evento TRABAJO_FINALIZADO
}

export interface CommissionSummary {
    totalAmount: number;
    entries: CommissionEntry[];
}

export interface CommissionPeriodSummary {
    today: CommissionSummary;
    week: CommissionSummary;
    month: CommissionSummary;
    allTime: CommissionSummary;
}

// ── Utilidades de zona horaria (sin librerías externas) ───────────────────────

/**
 * Extrae {year, month, day, weekday} de una fecha UTC
 * interpretada en la zona horaria de Guayaquil.
 */
function guePartsOf(utcDate: Date): {
    year: number; month: number; day: number; weekday: number;
} {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

    const parts = fmt.formatToParts(utcDate);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

    const weekdayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    return {
        year: parseInt(get('year'), 10),
        month: parseInt(get('month'), 10), // 1-12
        day: parseInt(get('day'), 10),
        weekday: weekdayMap[get('weekday')] ?? 0,
    };
}

/**
 * Devuelve el inicio del día, semana (lunes) y mes actuales
 * expresados como fechas UTC que delimitan rangos de consulta.
 *
 * UTC = localTime + 5h  (porque GYE = UTC-5)
 */
function gueRanges(now: Date): {
    todayStart: Date;
    weekStart: Date;
    monthStart: Date;
} {
    const GYE_OFFSET_MS = 5 * 60 * 60 * 1000;

    const { year, month, day, weekday } = guePartsOf(now);

    const localMidnight = (y: number, m: number, d: number): Date =>
        new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + GYE_OFFSET_MS);

    const todayStart = localMidnight(year, month, day);

    const daysToMonday = weekday === 0 ? 6 : weekday - 1;
    const mondayDate = new Date(Date.UTC(year, month - 1, day - daysToMonday));
    const { year: wy, month: wm, day: wd } = guePartsOf(mondayDate);
    const weekStart = localMidnight(wy, wm, wd);

    const monthStart = localMidnight(year, month, 1);

    return { todayStart, weekStart, monthStart };
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Calcula las comisiones de un técnico.
 *
 * @param userId       UUID del técnico
 * @param commissions  Reglas de comisión del empleado (activas o no)
 * @param orders       Órdenes del técnico (ya pre-filtradas por company + technicians.id)
 */
export function calculateCommissions(
    userId: string,
    commissions: Commission[],
    orders: OrderReplica[],
): CommissionPeriodSummary {

    // ── Índices por tipo ──────────────────────────────────────────────────────
    const deviceCommissionMap = new Map<string, Commission>(); // clave: DEVICE_TYPE_NAME
    const branchCommissionMap = new Map<string, Commission>(); // clave: BRANCH_NAME

    for (const c of commissions) {
        if (!c.active) continue;
        if (c.commissionType === 'device_category') {
            deviceCommissionMap.set(c.targetId.toUpperCase(), c);
        } else if (c.commissionType === 'branch') {
            branchCommissionMap.set(c.targetId.toUpperCase(), c);
        }
    }

    const now = new Date();
    const { todayStart, weekStart, monthStart } = gueRanges(now);

    const allEntries: CommissionEntry[] = [];

    for (const order of orders) {

        // ── 1. La orden debe haber llegado a TRABAJO_FINALIZADO ───────────────
        const finalizedEvent = (order.statusHistory ?? [])
            .filter(h => h.toStatus?.id === FINALIZED_STATUS_ID)
            .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())[0];

        if (!finalizedEvent) continue;

        const finalizedAt = new Date(finalizedEvent.changed_at);
        console.log(order)
        // ── 2. Resolver reglas aplicables ─────────────────────────────────────
        const deviceTypeName = order.device?.type?.name;
        const branchName = order.branch?.name;

        const deviceCommission = deviceTypeName
            ? deviceCommissionMap.get(deviceTypeName.toUpperCase())
            : undefined;

        const branchCommission = branchName
            ? branchCommissionMap.get(branchName.toUpperCase())
            : undefined;

        if (!deviceCommission && !branchCommission) continue;

        // ── 3. Recorrer procedimientos del técnico ────────────────────────────
        let technicianPerformedAny = false;
        let totalProcedureCostForBranch = 0;

        for (const finding of order.findings ?? []) {
            for (const procedure of finding.procedures ?? []) {

                if (procedure.performedBy?.id !== userId) continue;

                technicianPerformedAny = true;

                const procedureCost = procedure.procedure_cost ?? 0;

                // Acumular costo para comisión branch de tipo percentage
                if (procedureCost > 0) {
                    totalProcedureCostForBranch += procedureCost;
                }

                // ── Entry por procedimiento (device_category) ─────────────────
                if (deviceCommission && procedureCost > 0) {
                    let commissionAmount = 0;

                    if (deviceCommission.valueType === 'percentage') {
                        commissionAmount = procedureCost * (deviceCommission.value / 100);
                    } else if (deviceCommission.valueType === 'fixed') {
                        commissionAmount = deviceCommission.value;
                    }

                    if (commissionAmount > 0) {
                        allEntries.push({
                            orderId: order.id,
                            orderNumber: order.order_number,
                            deviceTypeName: deviceTypeName ?? '',
                            procedureId: procedure.id,
                            procedureDescription: procedure.description,
                            procedureCost,
                            commissionRate: deviceCommission.value,
                            commissionValueType: deviceCommission.valueType,
                            commissionAmount: Math.round(commissionAmount * 100) / 100,
                            finalizedAt,
                        });
                    }
                }
            }
        }

        // Si el técnico no realizó ningún procedimiento, ignorar la orden
        if (!technicianPerformedAny) continue;

        // ── 4. Entry por sucursal (una por orden) ─────────────────────────────
        if (branchCommission) {
            let commissionAmount = 0;

            if (branchCommission.valueType === 'fixed') {
                commissionAmount = branchCommission.value;
            } else if (branchCommission.valueType === 'percentage') {
                commissionAmount = totalProcedureCostForBranch * (branchCommission.value / 100);
            }

            if (commissionAmount > 0) {
                allEntries.push({
                    orderId: order.id,
                    orderNumber: order.order_number,
                    deviceTypeName: deviceTypeName ?? '',
                    procedureId: 0,                                          // sentinel: comisión por sucursal
                    procedureDescription: `Comisión por sucursal: ${branchName}`,
                    procedureCost: totalProcedureCostForBranch,
                    commissionRate: branchCommission.value,
                    commissionValueType: branchCommission.valueType,
                    commissionAmount: Math.round(commissionAmount * 100) / 100,
                    finalizedAt,
                });
            }
        }
    }

    // ── Filtrar por período usando finalizedAt ────────────────────────────────

    const summarize = (from: Date | null): CommissionSummary => {
        const entries = from
            ? allEntries.filter(e => e.finalizedAt >= from)
            : [...allEntries];

        return {
            totalAmount: Math.round(entries.reduce((s, e) => s + e.commissionAmount, 0) * 100) / 100,
            entries,
        };
    };

    return {
        today: summarize(todayStart),
        week: summarize(weekStart),
        month: summarize(monthStart),
        allTime: summarize(null),
    };
}

/**
 * Retorna true si el empleado tiene al menos una regla de comisión activa.
 */
export function hasActiveCommissions(commissions: Commission[]): boolean {
    return commissions.some(c => c.active);
}