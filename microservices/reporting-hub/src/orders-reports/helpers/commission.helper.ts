// helpers/commission.helper.ts
// ─────────────────────────────────────────────────────────────────────────────
// Calcula comisiones de un técnico cruzando sus órdenes (OrderReplica)
// con sus reglas de comisión (EmployeeCommission).
//
// Arquitectura:
//  • buildCommissionQueries() → genera los filtros + proyecciones de Mongoose
//    por tipo de comisión y período. El service ejecuta las queries en paralelo
//    y pasa los resultados a calculateCommissions().
//  • calculateCommissions()   → solo calcula montos, NO filtra por fecha
//    (MongoDB ya devuelve datos acotados al período correcto).
//
// Reglas de negocio:
//
//  ── commissionType === 'device_category' ────────────────────────────────────
//  • Filtro DB : company.id + device.type.name + performedBy.id + procedure_cost > 0
//                + primer evento statusHistory.toStatus.id === 7 dentro del período
//  • Se aplica POR PROCEDIMIENTO donde performedBy.id === userId y cost > 0.
//  • valueType === 'percentage' → amount = procedure_cost * (value / 100)
//  • valueType === 'fixed'     → amount = value
//
//  ── commissionType === 'branch_all_delivered' ────────────────────────────────
//  • Filtro DB : company.id + branch.name + statusHistory.toStatus.id === 8
//                (ENTREGADA) dentro del período. Sin filtro de técnico.
//  • Se aplica UNA VEZ POR ORDEN (procedureId = 0).
//  • valueType === 'fixed'     → amount = value
//  • valueType === 'percentage'→ amount = suma(todos los procedure_cost) * (value/100)
// ─────────────────────────────────────────────────────────────────────────────

import { Commission } from '../../users-employees-events/schemas/employee-commission.schema';

// ── Constantes de estado ──────────────────────────────────────────────────────

export const ORDER_STATUS = {
    INGRESADO: 1,
    VISTA: 2,
    EN_REVISION: 3,
    EN_ESPERA_APROBACION: 4,
    EN_BUSQUEDA_REPUESTO: 5,
    EN_REPARACION: 6,
    TRABAJO_FINALIZADO: 7,
    ENTREGADA: 8,
} as const;

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type CommissionPeriod = 'today' | 'week' | 'month';

/** Descriptor de una query que el service debe ejecutar */
export interface CommissionQueryDescriptor {
    period: CommissionPeriod;
    commissionType: string;   // 'device_category' | 'branch_all_delivered' | …
    targetId: string;         // valor de Commission.targetId (original, sin toUpperCase)
    filter: Record<string, any>;
    projection: Record<string, any>;
}

export interface CommissionEntry {
    orderId: number;
    orderNumber: number;
    deviceTypeName: string;
    procedureId: number;           // 0 = comisión por sucursal
    procedureDescription: string;
    procedureCost: number;
    commissionRate: number;
    commissionValueType: string;   // 'percentage' | 'fixed'
    commissionAmount: number;
    finalizedAt: Date;
}

export interface CommissionSummary {
    totalAmount: number;
    entries: CommissionEntry[];
}

export interface CommissionPeriodSummary {
    today: CommissionSummary;
    week: CommissionSummary;
    month: CommissionSummary;
}

/** Resultado de una query ejecutada por el service */
export interface CommissionQueryResult {
    period: CommissionPeriod;
    commissionType: string;
    targetId: string;
    orders: any[];   // documentos lean() de Mongoose
}

// ── Utilidades de zona horaria (sin librerías externas) ───────────────────────

const TIMEZONE = 'America/Guayaquil'; // UTC-5, sin DST

function guePartsOf(utcDate: Date): { year: number; month: number; day: number; weekday: number } {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    });
    const parts = fmt.formatToParts(utcDate);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const weekdayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return {
        year: parseInt(get('year'), 10),
        month: parseInt(get('month'), 10),
        day: parseInt(get('day'), 10),
        weekday: weekdayMap[get('weekday')] ?? 0,
    };
}

/**
 * Devuelve los límites de cada período en UTC,
 * calculados a partir de la hora local de Guayaquil (UTC-5).
 */
export function gueRanges(now: Date): Record<CommissionPeriod, Date> {
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

    return { today: todayStart, week: weekStart, month: monthStart };
}

// ── Proyección compartida ─────────────────────────────────────────────────────

const BASE_PROJECTION = {
    id: 1,
    order_number: 1,
    'device.type': 1,
    'branch.name': 1,
    'findings.procedures.id': 1,
    'findings.procedures.description': 1,
    'findings.procedures.procedure_cost': 1,
    'findings.procedures.performedBy': 1,
    'statusHistory.toStatus': 1,
    'statusHistory.changed_at': 1,
};

// ── buildCommissionQueries ────────────────────────────────────────────────────

/**
 * Genera los descriptores de query para cada comisión activa × cada período.
 * El service los ejecuta en paralelo con Promise.all y pasa los resultados
 * a calculateCommissions().
 *
 * @param companyId   ID de la empresa
 * @param userId      UUID del técnico
 * @param commissions Reglas de comisión del empleado
 */
export function buildCommissionQueries(
    companyId: string,
    userId: string,
    commissions: Commission[],
): CommissionQueryDescriptor[] {

    const now = new Date();
    const ranges = gueRanges(now);
    const descriptors: CommissionQueryDescriptor[] = [];

    for (const commission of commissions) {
        if (!commission.active) continue;

        const periods: CommissionPeriod[] = ['today', 'week', 'month'];

        for (const period of periods) {
            const periodStart = ranges[period];

            // ── device_category ───────────────────────────────────────────────
            if (commission.commissionType === 'device_category') {
                descriptors.push({
                    period,
                    commissionType: commission.commissionType,
                    targetId: commission.targetId,
                    filter: {
                        'company.id': companyId,
                        'device.type.name': commission.targetId,
                        'findings.procedures.performedBy.id': userId,
                        'findings.procedures.procedure_cost': { $gt: 0 },
                        statusHistory: {
                            $elemMatch: {
                                'toStatus.id': ORDER_STATUS.TRABAJO_FINALIZADO,
                                changed_at: { $gte: periodStart },
                            },
                        },
                    },
                    projection: BASE_PROJECTION,
                });
            }

            // ── branch_all_delivered ──────────────────────────────────────────
            else if (commission.commissionType === 'branch_all_delivered') {
                descriptors.push({
                    period,
                    commissionType: commission.commissionType,
                    targetId: commission.targetId,
                    filter: {
                        'company.id': companyId,
                        'branch.name': commission.targetId,
                        statusHistory: {
                            $elemMatch: {
                                'toStatus.id': ORDER_STATUS.ENTREGADA,
                                changed_at: { $gte: periodStart },
                            },
                        },
                    },
                    projection: BASE_PROJECTION,
                });
            }

            // ── Tipos futuros: agregar bloques else if aquí ───────────────────
        }
    }

    return descriptors;
}

// ── calculateCommissions ──────────────────────────────────────────────────────

/**
 * Calcula las comisiones a partir de los resultados de las queries ejecutadas
 * por el service. No filtra por fecha (MongoDB ya lo hizo).
 *
 * @param userId   UUID del técnico
 * @param commissions  Reglas de comisión del empleado
 * @param results  Resultados de las queries ejecutadas por el service
 */
export function calculateCommissions(
    userId: string,
    commissions: Commission[],
    results: CommissionQueryResult[],
): CommissionPeriodSummary {

    // Índice de comisiones activas por tipo+targetId para lookup O(1)
    const commissionIndex = new Map<string, Commission>();
    for (const c of commissions) {
        if (!c.active) continue;
        commissionIndex.set(`${c.commissionType}::${c.targetId.toUpperCase()}`, c);
    }

    const periodEntries: Record<CommissionPeriod, CommissionEntry[]> = {
        today: [],
        week: [],
        month: [],
    };

    for (const result of results) {
        const { period, commissionType, targetId, orders } = result;
        const commission = commissionIndex.get(`${commissionType}::${targetId.toUpperCase()}`);
        if (!commission) continue;

        for (const order of orders) {

            // ── Fecha de referencia: primer evento TRABAJO_FINALIZADO ─────────
            const finalizedEvent = (order.statusHistory ?? [])
                .filter((h: any) => h.toStatus?.id === ORDER_STATUS.TRABAJO_FINALIZADO)
                .sort((a: any, b: any) =>
                    new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
                )[0];

            if (!finalizedEvent) continue;
            const finalizedAt = new Date(finalizedEvent.changed_at);

            const deviceTypeName = order.device?.type?.name ?? '';
            const branchName = order.branch?.name ?? '';

            // ── device_category: una entry por procedimiento del técnico ──────
            if (commissionType === 'device_category') {
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

                        if (commissionAmount > 0) {
                            periodEntries[period].push({
                                orderId: order.id,
                                orderNumber: order.order_number,
                                deviceTypeName,
                                procedureId: procedure.id,
                                procedureDescription: procedure.description,
                                procedureCost,
                                commissionRate: commission.value,
                                commissionValueType: commission.valueType,
                                commissionAmount: Math.round(commissionAmount * 100) / 100,
                                finalizedAt,
                            });
                        }
                    }
                }
            }

            // ── branch_all_delivered: una entry por orden ─────────────────────
            else if (commissionType === 'branch_all_delivered') {
                // Verificar que la orden llegó a ENTREGADA
                const wasDelivered = (order.statusHistory ?? [])
                    .some((h: any) => h.toStatus?.id === ORDER_STATUS.ENTREGADA);
                if (!wasDelivered) continue;

                // Acumular costo total de la orden (para valueType percentage)
                let totalProcedureCost = 0;
                for (const finding of order.findings ?? []) {
                    for (const procedure of finding.procedures ?? []) {
                        totalProcedureCost += procedure.procedure_cost ?? 0;
                    }
                }

                let commissionAmount = 0;
                if (commission.valueType === 'fixed') {
                    commissionAmount = commission.value;
                } else if (commission.valueType === 'percentage') {
                    commissionAmount = totalProcedureCost * (commission.value / 100);
                }

                if (commissionAmount > 0) {
                    periodEntries[period].push({
                        orderId: order.id,
                        orderNumber: order.order_number,
                        deviceTypeName,
                        procedureId: 0,
                        procedureDescription: `Comisión por sucursal: ${branchName}`,
                        procedureCost: totalProcedureCost,
                        commissionRate: commission.value,
                        commissionValueType: commission.valueType,
                        commissionAmount: Math.round(commissionAmount * 100) / 100,
                        finalizedAt,
                    });
                }
            }

            // ── Tipos futuros: agregar bloques else if aquí ───────────────────
        }
    }

    const summarize = (entries: CommissionEntry[]): CommissionSummary => ({
        totalAmount: Math.round(entries.reduce((s, e) => s + e.commissionAmount, 0) * 100) / 100,
        entries,
    });

    return {
        today: summarize(periodEntries.today),
        week: summarize(periodEntries.week),
        month: summarize(periodEntries.month),
    };
}

// ── hasActiveCommissions ──────────────────────────────────────────────────────

export function hasActiveCommissions(commissions: Commission[]): boolean {
    return commissions.some(c => c.active);
}