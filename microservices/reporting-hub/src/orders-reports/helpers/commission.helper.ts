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
//  • commissionType === 'device_category' → targetId === order.device.type.name
//  • La comisión aplica SOLO al procedure_cost de procedimientos donde
//    performedBy.id === userId (el técnico que realizó el trabajo).
//  • valueType === 'percentage' → amount = procedure_cost * (value / 100)
//  • valueType === 'fixed'     → amount = value  (si el procedimiento tiene costo > 0)
// ─────────────────────────────────────────────────────────────────────────────

import { OrderReplica } from "../../orders-relay/schemas/order-replica.schema";
import { Commission } from "../../users-employees-events/schemas/employee-commission.schema";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIMEZONE = 'America/Guayaquil'; // UTC-5, sin DST
const FINALIZED_STATUS_ID = 7;                  // TRABAJO_FINALIZADO

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export interface CommissionEntry {
    orderId: number;
    orderNumber: number;
    deviceTypeName: string;
    procedureId: number;
    procedureDescription: string;
    procedureCost: number;
    commissionRate: number;       // valor configurado (% o monto fijo)
    commissionValueType: string;       // 'percentage' | 'fixed'
    commissionAmount: number;       // monto calculado final
    finalizedAt: Date;         // changed_at del evento TRABAJO_FINALIZADO
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
        month: parseInt(get('month'), 10),   // 1-12
        day: parseInt(get('day'), 10),
        weekday: weekdayMap[get('weekday')] ?? 0,
    };
}

/**
 * Devuelve el inicio de la semana (lunes) y del día, mes y año actual
 * expresados como fechas UTC que delimitan rangos de consulta.
 *
 * Estrategia: tomamos los componentes locales de "hoy en Guayaquil"
 * y construimos el límite inferior sumando/restando días, luego lo
 * convertimos a UTC restando el offset fijo de -5 h.
 *
 * UTC = localTime + 5h  (porque GYE = UTC-5)
 */
function gueRanges(now: Date): {
    todayStart: Date;
    weekStart: Date;
    monthStart: Date;
} {
    const GYE_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5 → sumar 5 h para pasar a UTC

    const { year, month, day, weekday } = guePartsOf(now);

    // Inicio del día local → medianoche GYE → UTC
    const localMidnight = (y: number, m: number, d: number): Date =>
        new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + GYE_OFFSET_MS);

    const todayStart = localMidnight(year, month, day);

    // Lunes de la semana actual
    const daysToMonday = weekday === 0 ? 6 : weekday - 1;
    const mondayDate = new Date(Date.UTC(year, month - 1, day - daysToMonday));
    const { year: wy, month: wm, day: wd } = guePartsOf(mondayDate);
    const weekStart = localMidnight(wy, wm, wd);

    // Primer día del mes
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

    // Solo reglas activas de tipo device_category
    const activeCommissions = commissions.filter(c => c.active && c.commissionType === 'device_category');

    // Índice: DEVICE_TYPE_NAME (uppercase) → Commission
    const commissionMap = new Map<string, Commission>();
    for (const c of activeCommissions) {
        commissionMap.set(c.targetId.toUpperCase(), c);
    }

    const now = new Date();
    const { todayStart, weekStart, monthStart } = gueRanges(now);

    const allEntries: CommissionEntry[] = [];

    for (const order of orders) {

        // ── 1. La orden debe haber llegado a TRABAJO_FINALIZADO ───────────────
        const finalizedEvent = (order.statusHistory ?? [])
            .filter(h => h.toStatus?.id === FINALIZED_STATUS_ID)
            .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())[0];

        if (!finalizedEvent) continue; // nunca llegó a TRABAJO_FINALIZADO → ignorar

        const finalizedAt = new Date(finalizedEvent.changed_at);

        // ── 2. Tiene que coincidir la categoría del dispositivo ───────────────
        const deviceTypeName = order.device?.type?.name?.toUpperCase();
        if (!deviceTypeName) continue;

        const commission = commissionMap.get(deviceTypeName);
        if (!commission) continue;

        // ── 3. Recorrer procedimientos del técnico con costo ──────────────────
        for (const finding of order.findings ?? []) {
            for (const procedure of finding.procedures ?? []) {

                if (procedure.performedBy?.id !== userId) continue;

                const procedureCost = procedure.procedure_cost ?? 0;
                if (procedureCost <= 0) continue;

                let commissionAmount = 0;
                if (commission.valueType === 'percentage') {
                    commissionAmount = procedureCost * (commission.value / 100);
                } else if (commission.valueType === 'fixed') {
                    commissionAmount = commission.value;
                }

                if (commissionAmount <= 0) continue;

                allEntries.push({
                    orderId: order.id,
                    orderNumber: order.order_number,
                    deviceTypeName: order.device!.type!.name,
                    procedureId: procedure.id,
                    procedureDescription: procedure.description,
                    procedureCost,
                    commissionRate: commission.value,
                    commissionValueType: commission.valueType,
                    commissionAmount: Math.round(commissionAmount * 100) / 100,
                    finalizedAt,          // fecha de TRABAJO_FINALIZADO en GYE
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