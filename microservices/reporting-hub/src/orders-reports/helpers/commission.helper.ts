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
//  • Filtro DB : company.id + branch.name + type.id === 1 (SERVICIO_TECNICO)
//                + statusHistory.toStatus.id === 8 (ENTREGADA) dentro del período.
//                Sin filtro de técnico.
//  • Condición helper: al menos un procedimiento con was_solved === true
//                      (flag BRANCH_ALL_DELIVERED_REQUIRE_ALL_SOLVED para modo estricto)
//  • Se aplica UNA VEZ POR ORDEN (procedureId = 0).
//  • valueType === 'fixed'     → amount = value
//  • valueType === 'percentage'→ amount = suma(todos los procedure_cost) * (value/100)
//
//  ── commissionType === 'all_devices_delivered' ───────────────────────────────
//  • Filtro DB : company.id + type.id === 1 (SERVICIO_TECNICO)
//                + statusHistory.toStatus.id === 8 (ENTREGADA) dentro del período.
//                Sin filtro de sucursal, técnico ni tipo de dispositivo.
//  • Condición helper: al menos un procedimiento con was_solved === true
//  • Condición helper: revisadoAntes === false
//  • Condición helper: suma(procedure_cost) >= ALL_DEVICES_DELIVERED_MIN_PROCEDURE_COST
//  • Se aplica UNA VEZ POR ORDEN (procedureId = 0).
//  • valueType === 'fixed'     → amount = value
//  • valueType === 'percentage'→ amount = suma(todos los procedure_cost) * (value/100)
//
//  En BD se guarda con targetId: "*" (comodín — aplica a todos los dispositivos).
//
//  ── commissionType === 'national_device_delivered' ───────────────────────────
//  • Filtro DB : company.id + type.id === 1 (SERVICIO_TECNICO)
//                + is_national === true
//                + statusHistory.toStatus.id === 8 (ENTREGADA) dentro del período.
//                Sin filtro de sucursal, técnico ni tipo de dispositivo.
//  • Condición helper: al menos un procedimiento con was_solved === true
//  • Condición helper: revisadoAntes === false  (no es garantía)
//  • Condición helper: suma(procedure_cost) >= NATIONAL_DEVICE_DELIVERED_MIN_PROCEDURE_COST
//  • Se aplica UNA VEZ POR ORDEN (procedureId = 0).
//  • valueType === 'fixed'     → amount = value
//  • valueType === 'percentage'→ amount = suma(todos los procedure_cost) * (value/100)
//
//  En BD se guarda con targetId: "*" (comodín — aplica a todos los dispositivos nacionales).
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

export const ORDER_TYPE = {
    SERVICIO_TECNICO: 1,
    PERSONALIZADO: 2,
    PARA_REPUESTOS: 3,
} as const;

// ── Umbrales mínimos de costo ─────────────────────────────────────────────────

/** Monto mínimo de la suma de procedimientos para aplicar branch_all_delivered */
export const BRANCH_ALL_DELIVERED_MIN_PROCEDURE_COST = 5;

/** Monto mínimo de la suma de procedimientos para aplicar all_devices_delivered */
export const ALL_DEVICES_DELIVERED_MIN_PROCEDURE_COST = 5;

/**
 * Monto mínimo de la suma de procedimientos para aplicar national_device_delivered.
 * Solo aplica a órdenes con is_national === true.
 */
export const NATIONAL_DEVICE_DELIVERED_MIN_PROCEDURE_COST = 5;

// ── Flags de comportamiento ───────────────────────────────────────────────────

/**
 * branch_all_delivered: condición sobre procedimientos con solución.
 *
 * false → al menos UN procedimiento debe tener was_solved === true (actual)
 * true  → TODOS los procedimientos deben tener was_solved === true (futuro)
 */
const BRANCH_ALL_DELIVERED_REQUIRE_ALL_SOLVED = false;

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type CommissionPeriod = 'today' | 'week' | 'month';

/** Descriptor de una query que el service debe ejecutar */
export interface CommissionQueryDescriptor {
    period: CommissionPeriod;
    commissionType: string;   // 'device_category' | 'branch_all_delivered' | 'all_devices_delivered' | 'national_device_delivered' | …
    targetId: string;         // valor de Commission.targetId (original, sin toUpperCase)
    filter: Record<string, any>;
    projection: Record<string, any>;
}

export interface CommissionEntry {
    orderId: number;
    orderNumber: number;
    deviceTypeName: string;
    procedureId: number;           // 0 = comisión por sucursal / por todos los dispositivos
    procedureDescription: string;
    procedureCost: number;
    commissionRate: number;
    commissionValueType: string;   // 'percentage' | 'fixed'
    commissionAmount: number;
    referenceDate: Date;           // fecha del evento que activó la comisión
    referenceDateLabel: string;    // 'Fecha finalización' | 'Fecha entrega'
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

// ── Proyecciones ──────────────────────────────────────────────────────────────

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

/**
 * Proyección extendida para tipos que necesitan was_solved y revisadoAntes.
 * Se usa en branch_all_delivered, all_devices_delivered y national_device_delivered.
 */
const SOLVED_PROJECTION = {
    ...BASE_PROJECTION,
    'findings.procedures.was_solved': 1,
    revisadoAntes: 1,
    is_national: 1,
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
    //console.log(commissions)
    for (const commission of commissions) {
        if (!commission.active) continue;

        const periods: CommissionPeriod[] = ['today', 'week', 'month'];

        for (const period of periods) {
            const periodStart = ranges[period];

            // ── device_category ───────────────────────────────────────────────
            // Aplica por procedimiento del técnico en órdenes finalizadas (status 7).
            // targetId corresponde a device.type.name exacto.
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
            // Aplica una vez por orden entregada (status 8) en una sucursal dada.
            // targetId corresponde a branch.name exacto.
            else if (commission.commissionType === 'branch_all_delivered') {
                descriptors.push({
                    period,
                    commissionType: commission.commissionType,
                    targetId: commission.targetId,
                    filter: {
                        'company.id': companyId,
                        'branch.name': commission.targetId,
                        'type.id': ORDER_TYPE.SERVICIO_TECNICO,
                        is_national: false,
                        statusHistory: {
                            $elemMatch: {
                                'toStatus.id': ORDER_STATUS.ENTREGADA,
                                changed_at: { $gte: periodStart },
                            },
                        },
                    },
                    projection: SOLVED_PROJECTION,
                });
            }

            // ── all_devices_delivered ─────────────────────────────────────────
            // Aplica una vez por orden entregada (status 8) sin importar sucursal,
            // técnico ni tipo de dispositivo. targetId siempre debe ser "*".
            // Condiciones adicionales evaluadas en calculateCommissions():
            //   • al menos un procedimiento con was_solved === true
            //   • revisadoAntes === false  (no es garantía)
            //   • suma(procedure_cost) >= ALL_DEVICES_DELIVERED_MIN_PROCEDURE_COST
            else if (commission.commissionType === 'all_devices_delivered') {
                descriptors.push({
                    period,
                    commissionType: commission.commissionType,
                    targetId: commission.targetId,   // "*"
                    filter: {
                        'company.id': companyId,
                        'type.id': ORDER_TYPE.SERVICIO_TECNICO,
                        is_national: false,
                        statusHistory: {
                            $elemMatch: {
                                'toStatus.id': ORDER_STATUS.ENTREGADA,
                                changed_at: { $gte: periodStart },
                            },
                        },
                    },
                    projection: SOLVED_PROJECTION,
                });
            }

            // ── national_device_delivered ─────────────────────────────────────
            // Aplica una vez por orden entregada (status 8) donde is_national === true,
            // sin importar sucursal, técnico ni tipo de dispositivo.
            // targetId siempre debe ser "*".
            // El filtro is_national se resuelve completamente en MongoDB;
            // no se necesita verificación adicional en el helper.
            // Condiciones adicionales evaluadas en calculateCommissions():
            //   • al menos un procedimiento con was_solved === true
            //   • revisadoAntes === false  (no es garantía)
            //   • suma(procedure_cost) >= NATIONAL_DEVICE_DELIVERED_MIN_PROCEDURE_COST
            else if (commission.commissionType === 'national_device_delivered') {

                descriptors.push({
                    period,
                    commissionType: commission.commissionType,
                    targetId: commission.targetId,   // "*"
                    filter: {
                        'company.id': companyId,
                        'type.id': ORDER_TYPE.SERVICIO_TECNICO,
                        is_national: true,
                        statusHistory: {
                            $elemMatch: {
                                //'toStatus.id': ORDER_STATUS.ENTREGADA,
                                changed_at: { $gte: periodStart },
                            },
                        },
                    },
                    projection: SOLVED_PROJECTION,
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
 * @param userId      UUID del técnico
 * @param commissions Reglas de comisión del empleado
 * @param results     Resultados de las queries ejecutadas por el service
 */
export function calculateCommissions(
    userId: string,
    commissions: Commission[],
    results: CommissionQueryResult[],
): CommissionPeriodSummary {


    // Índice de comisiones activas por tipo+targetId para lookup O(1).
    // all_devices_delivered y national_device_delivered usan targetId "*" como clave.
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
        const commission = targetId
            ? commissionIndex.get(`${commissionType}::${targetId.toUpperCase()}`)
            : undefined;
        if (!commission) continue;

        for (const order of orders) {

            const deviceTypeName = order.device?.type?.name ?? '';
            const branchName = order.branch?.name ?? '';

            // ── Utilidad: primer evento de un status dado ─────────────────────
            const firstEventOf = (statusId: number): Date | null => {
                const event = (order.statusHistory ?? [])
                    .filter((h: any) => h.toStatus?.id === statusId)
                    .sort((a: any, b: any) =>
                        new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
                    )[0];
                return event ? new Date(event.changed_at) : null;
            };

            // ── device_category ───────────────────────────────────────────────
            // Una entry por procedimiento del técnico con cost > 0.
            // Fecha de referencia: primer evento TRABAJO_FINALIZADO (7).
            if (commissionType === 'device_category') {
                const referenceDate = firstEventOf(ORDER_STATUS.TRABAJO_FINALIZADO);
                if (!referenceDate) continue;

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
                                referenceDate,
                                referenceDateLabel: 'Fecha finalización',
                            });
                        }
                    }
                }
            }

            // ── branch_all_delivered ──────────────────────────────────────────
            // Una entry por orden entregada en la sucursal indicada.
            // Fecha de referencia: primer evento ENTREGADA (8).
            else if (commissionType === 'branch_all_delivered') {
                const referenceDate = firstEventOf(ORDER_STATUS.ENTREGADA);
                if (!referenceDate) continue;

                const allProcedures = (order.findings ?? [])
                    .flatMap((f: any) => f.procedures ?? []);

                // Validar condición de was_solved
                const solvedCheck = BRANCH_ALL_DELIVERED_REQUIRE_ALL_SOLVED
                    ? allProcedures.length > 0 && allProcedures.every((p: any) => p.was_solved === true)
                    : allProcedures.some((p: any) => p.was_solved === true);

                if (!solvedCheck) continue;

                const totalProcedureCost = allProcedures.reduce(
                    (sum: number, p: any) => sum + (p.procedure_cost ?? 0), 0
                );

                if (totalProcedureCost < BRANCH_ALL_DELIVERED_MIN_PROCEDURE_COST) continue;

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
                        referenceDate,
                        referenceDateLabel: 'Fecha entrega',
                    });
                }
            }

            // ── all_devices_delivered ─────────────────────────────────────────
            // Una entry por orden entregada sin filtro de sucursal ni técnico.
            // Fecha de referencia: primer evento ENTREGADA (8).
            // Condiciones:
            //   1. revisadoAntes === false  → la orden no es una garantía
            //   2. Al menos un procedimiento con was_solved === true
            //   3. Suma de procedure_cost >= ALL_DEVICES_DELIVERED_MIN_PROCEDURE_COST
            else if (commissionType === 'all_devices_delivered') {
                const referenceDate = firstEventOf(ORDER_STATUS.ENTREGADA);
                if (!referenceDate) continue;

                // 1. No es una revisión previa (garantía)
                if (order.revisadoAntes === true) continue;

                const allProcedures = (order.findings ?? [])
                    .flatMap((f: any) => f.procedures ?? []);

                // 2. Al menos un procedimiento solucionado
                const hasSolvedProcedure = allProcedures.some((p: any) => p.was_solved === true);
                if (!hasSolvedProcedure) continue;

                // 3. Costo mínimo
                const totalProcedureCost = allProcedures.reduce(
                    (sum: number, p: any) => sum + (p.procedure_cost ?? 0), 0
                );
                if (totalProcedureCost < ALL_DEVICES_DELIVERED_MIN_PROCEDURE_COST) continue;

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
                        procedureDescription: `Comisión por entrega: todos los dispositivos`,
                        procedureCost: totalProcedureCost,
                        commissionRate: commission.value,
                        commissionValueType: commission.valueType,
                        commissionAmount: Math.round(commissionAmount * 100) / 100,
                        referenceDate,
                        referenceDateLabel: 'Fecha entrega',
                    });
                }
            }

            // ── national_device_delivered ─────────────────────────────────────
            // Una entry por orden nacional entregada (is_national === true).
            // MongoDB ya filtró is_national en el query; aquí solo se evalúan
            // las condiciones de negocio que no pueden resolverse en BD.
            // Fecha de referencia: primer evento ENTREGADA (8).
            // Condiciones:
            //   1. revisadoAntes === false  → la orden no es una garantía
            //   2. Al menos un procedimiento con was_solved === true
            //   3. Suma de procedure_cost >= NATIONAL_DEVICE_DELIVERED_MIN_PROCEDURE_COST
            else if (commissionType === 'national_device_delivered') {
                const referenceDate = firstEventOf(ORDER_STATUS.ENTREGADA);
                if (!referenceDate) continue;

                // 1. No es una revisión previa (garantía)
                if (order.revisadoAntes === true) continue;

                const allProcedures = (order.findings ?? [])
                    .flatMap((f: any) => f.procedures ?? []);

                // 2. Al menos un procedimiento solucionado
                const hasSolvedProcedure = allProcedures.some((p: any) => p.was_solved === true);
                if (!hasSolvedProcedure) continue;

                // 3. Costo mínimo
                const totalProcedureCost = allProcedures.reduce(
                    (sum: number, p: any) => sum + (p.procedure_cost ?? 0), 0
                );
                if (totalProcedureCost < NATIONAL_DEVICE_DELIVERED_MIN_PROCEDURE_COST) continue;

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
                        procedureDescription: `Comisión por entrega: equipo nacional`,
                        procedureCost: totalProcedureCost,
                        commissionRate: commission.value,
                        commissionValueType: commission.valueType,
                        commissionAmount: Math.round(commissionAmount * 100) / 100,
                        referenceDate,
                        referenceDateLabel: 'Fecha entrega',
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