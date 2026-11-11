// microservices/orders/src/order-part-request/part-request-report.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PartRequest } from './entities/part-request.entity';
import { PartRequestPayment } from './entities/part-request-payment.entity';
import { PartRequestPaymentAllocation } from './entities/part-request-payment-allocation.entity';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { PartRequestStatus } from './entities/enums/part-request-status.enum';
import { NationalSourcingReportFilters } from './dto/national-sourcing-report.dto';
import { formatPartRequestNumber } from './helpers/company-numbering.helper';
import { OrderStatus } from '../catalogs/entities/order_status.entity';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';

const S = PartRequestStatus;

/** Grupo cuyos empleados aparecen en el filtro "quién encontró" */
const EMPLOYEE_GROUP = 'LOGISTICA_REPUESTOS';

/** Estados de solicitud alcanzables en el flujo nacional (después del hallazgo) */
const ESTADOS_SOLICITUD_FILTRO: Array<{ value: PartRequestStatus; label: string }> = [
    { value: S.ESPERA_DE_PAGO, label: 'Espera de pago' },
    { value: S.EN_PROCESO_DE_PEDIDO, label: 'En proceso de pedido' },
    { value: S.LLEGADO_PENDIENTE_VALIDACION, label: 'Llegado, pendiente de validación' },
    { value: S.LLEGADO_ASIGNADO, label: 'Llegado y asignado' },
    { value: S.PENDIENTE_INGRESO, label: 'Pendiente de ingreso' },
    { value: S.INGRESADO_ASIGNADO, label: 'Ingresado y asignado' },
    { value: S.LITIGIO, label: 'Litigio' },
    { value: S.CANCELADO, label: 'Cancelado' },
];

const STATIC_FILTERS = {
    fechaCampo: [
        { value: 'solicitud', label: 'Fecha de solicitud' },
        { value: 'encontrado', label: 'Fecha en que se encontró' },
        { value: 'llegada', label: 'Fecha de llegada' },
        { value: 'entrega', label: 'Fecha de entrega de la orden' },
    ],
    pago: [
        { value: 'SIN_PAGO', label: 'Sin pago' },
        { value: 'PARCIAL', label: 'Pago parcial' },
        { value: 'PAGADO', label: 'Pagado' },
    ],
    litigio: [
        { value: 'NINGUNO', label: 'Sin litigio' },
        { value: 'ACTIVO', label: 'Litigio activo' },
        { value: 'RESUELTO', label: 'Litigio resuelto' },
        { value: 'CANCELADO_SIN_RESOLVER', label: 'Cancelado sin resolver' },
    ],
    motivoCategoria: [
        { value: 'PRODUCTO_INCORRECTO', label: 'Producto incorrecto' },
        { value: 'CALIDAD_DEFICIENTE', label: 'Calidad deficiente' },
        { value: 'DAÑADO_EN_TRANSITO', label: 'Dañado en tránsito' },
        { value: 'CANTIDAD_INCOMPLETA', label: 'Cantidad incompleta' },
        { value: 'VENDIDO', label: 'Vendido' },
        { value: 'OTRO', label: 'Otro' },
    ],
};

// ─── Fragmentos SQL reutilizables ───────────────────────────────────
// Aliases: pr=part_request, s=sourcing, prov=provider, rb=responsable búsqueda,
// tec=técnico, o=order, os=order status, od=order delivery, arr=arrival,
// rp=resuelto por, pay=pagos agregados, hist=historial agregado.

/** Fecha de hallazgo: transición SOLICITADO -> ESPERA_DE_PAGO; fallback a la creación del sourcing */
const FOUND_AT = `COALESCE(hist.fecha_encontrado, s.createdAt)`;

/** Total a pagar = precio * cantidad + transporte (ver nota: confirmar contra el módulo de pagos) */
const DUE = `(COALESCE(s.precio, 0) * COALESCE(s.cantidad, 1) + COALESCE(s.precio_transporte, 0))`;
const PAID = `COALESCE(pay.monto_pagado, 0)`;

const PAGO_CASE = `CASE
    WHEN ${PAID} = 0 THEN 'SIN_PAGO'
    WHEN ${PAID} >= ${DUE} THEN 'PAGADO'
    ELSE 'PARCIAL' END`;

/**
 * resuelto=true            -> RESUELTO   (resolverLitigio deja el estado en LITIGIO, por eso NO se usa pr.estado para esto)
 * estado=LITIGIO           -> ACTIVO
 * pasó por LITIGIO (hist.) -> CANCELADO_SIN_RESOLVER (cancelarPartRequest permite cancelar desde LITIGIO)
 */
const LITIGIO_CASE = `CASE
    WHEN COALESCE(arr.resuelto, false) = true THEN 'RESUELTO'
    WHEN pr.estado = '${S.LITIGIO}' THEN 'ACTIVO'
    WHEN COALESCE(hist.tuvo_litigio, false) = true THEN 'CANCELADO_SIN_RESOLVER'
    ELSE 'NINGUNO' END`;

const TRAVEL_EXISTS = `EXISTS (SELECT 1 FROM part_request_travel_items t WHERE t.part_request_id = pr.id)`;
const TRAVEL_LAST = `(SELECT t.status FROM part_request_travel_items t WHERE t.part_request_id = pr.id ORDER BY t.id DESC LIMIT 1)`;

const DATE_FIELDS: Record<string, string> = {
    solicitud: 'pr.createdAt',
    encontrado: FOUND_AT,
    llegada: 'arr.createdAt',
    entrega: 'od.delivered_at',
};

/** Columnas del listado: [expresión SQL, alias] */
const LIST_COLUMNS: Array<[string, string]> = [
    ['pr.id', 'id'],
    ['pr.numero', 'numero'],
    ['pr.descripcion', 'descripcion'],
    ['pr.marca', 'marca'],
    ['pr.modelo', 'modelo'],
    ['pr.estado', 'estado'],
    ['pr.precio_venta', 'precio_venta'],
    ['pr.createdAt', 'fecha_solicitud'],
    [FOUND_AT, 'fecha_encontrado'],

    ['pr.responsable_busqueda_id', 'encontrado_por_id'],
    ['rb.first_name', 'encontrado_por_nombre'],
    ['rb.last_name', 'encontrado_por_apellido'],
    ['tec.id', 'tecnico_id'],
    ['tec.first_name', 'tecnico_nombre'],
    ['tec.last_name', 'tecnico_apellido'],

    ['prov.id', 'provider_id'],
    ['prov.nombre', 'provider_nombre'],
    ['s.precio', 'precio'],
    ['s.cantidad', 'cantidad'],
    ['s.precio_transporte', 'precio_transporte'],

    [DUE, 'monto_total'],
    [PAID, 'monto_pagado'],
    ['pay.ultimo_pago', 'ultimo_pago'],
    [PAGO_CASE, 'pago_estado'],

    ['o.id', 'order_id'],
    ['o.order_number', 'order_number'],
    ['os.id', 'order_status_id'],
    ['os.name', 'order_status'],
    ['o.entry_date', 'order_entry_date'],
    ['od.delivered_at', 'order_delivered_at'],

    ['arr.resultado_validacion', 'validacion_llegada'],
    ['arr.createdAt', 'fecha_llegada'],
    [LITIGIO_CASE, 'litigio_estado'],
    ['arr.motivo_categoria', 'motivo_categoria'],
    ['arr.motivo_rechazo', 'motivo'],
    ['arr.fecha_validacion', 'fecha_litigio'],
    ['arr.fecha_resolucion', 'fecha_resolucion'],
    ['arr.descripcion_resolucion', 'descripcion_resolucion'],
    ['rp.first_name', 'resuelto_por_nombre'],
    ['rp.last_name', 'resuelto_por_apellido'],

    [TRAVEL_LAST, 'viajero_estado'],
];

const fullName = (first?: string | null, last?: string | null) =>
    first ? `${first} ${last ?? ''}`.trim() : null;

/** Día siguiente (YYYY-MM-DD) para usar fechaHasta como límite exclusivo */
const nextDay = (ymd: string) => {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
};

@Injectable()
export class PartRequestReportService {
    constructor(
        @InjectRepository(PartRequest) private readonly partRequestRepo: Repository<PartRequest>,
        @InjectRepository(OrderStatus) private readonly orderStatusRepo: Repository<OrderStatus>,
        @InjectRepository(UserEmployeeCache) private readonly employeeRepo: Repository<UserEmployeeCache>,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Catálogo de filtros (va en cada respuesta)
    // ─────────────────────────────────────────────────────────────
    private async getFilterOptions(companyId: string) {
        const [estadosOrden, empleados] = await Promise.all([
            this.orderStatusRepo.find({ order: { id: 'ASC' } }),
            this.employeeRepo
                .createQueryBuilder('e')
                .innerJoin('e.groups', 'g')
                .select(['e.id', 'e.first_name', 'e.last_name'])
                .where('"e"."company_id" = :companyId', { companyId })
                .andWhere('g.group_name = :group', { group: EMPLOYEE_GROUP })
                .distinct(true)
                .orderBy('e.first_name', 'ASC')
                .addOrderBy('e.last_name', 'ASC')
                .getMany(),
        ]);

        return {
            estadosSolicitud: ESTADOS_SOLICITUD_FILTRO,
            estadosOrden: estadosOrden.map((s) => ({ value: s.id, label: s.name })),
            empleados: empleados.map((e) => ({ value: e.id, label: fullName(e.first_name, e.last_name) })),
            ...STATIC_FILTERS,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Query base: joins + filtros (sin select)
    // ─────────────────────────────────────────────────────────────
    private baseQuery(companyId: string, f: NationalSourcingReportFilters): SelectQueryBuilder<PartRequest> {
        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            // innerJoin: solo solicitudes con hallazgo registrado (sourcing)
            .innerJoin('pr.sourcing', 's')
            .leftJoin('s.provider', 'prov')
            .leftJoin('pr.responsableBusqueda', 'rb')
            .leftJoin('pr.technician', 'tec')
            .leftJoin('pr.order', 'o')
            .leftJoin('o.currentStatus', 'os')
            .leftJoin('o.delivery', 'od')
            .leftJoin('pr.arrival', 'arr')
            .leftJoin('arr.resueltoPor', 'rp')
            // pagos agregados por solicitud
            .leftJoin(
                (sq) =>
                    sq
                        .select('al.part_request_id', 'part_request_id')
                        .addSelect('SUM(al.monto_asignado)', 'monto_pagado')
                        .addSelect('MAX(pm.fecha_pago)', 'ultimo_pago')
                        .from(PartRequestPaymentAllocation, 'al')
                        .innerJoin(PartRequestPayment, 'pm', 'pm.id = al.payment_id')
                        .groupBy('al.part_request_id'),
                'pay',
                'pay.part_request_id = pr.id',
            )
            // historial agregado: fecha del hallazgo + si alguna vez estuvo en litigio
            .leftJoin(
                (sq) =>
                    sq
                        .select('hs.part_request_id', 'part_request_id')
                        .addSelect(
                            `MIN(hs.fecha) FILTER (WHERE hs.estado_anterior = '${S.SOLICITADO}' AND hs.estado_nuevo = '${S.ESPERA_DE_PAGO}')`,
                            'fecha_encontrado',
                        )
                        .addSelect(`BOOL_OR(hs.estado_nuevo = '${S.LITIGIO}')`, 'tuvo_litigio')
                        .from(PartRequestStatusHistory, 'hs')
                        .groupBy('hs.part_request_id'),
                'hist',
                'hist.part_request_id = pr.id',
            )
            .where('pr.company_id = :companyId', { companyId })
            // encontradoNacional escribe `tipo = 'NACIONAL'` (no tipoRepuesto); se aceptan ambos
            .andWhere(`(pr.tipo = 'NACIONAL' OR pr.tipoRepuesto = 'NACIONAL')`);

        // ── Fechas ──
        const dateExpr = DATE_FIELDS[f.fechaCampo ?? 'encontrado'] ?? FOUND_AT;
        if (f.fechaDesde) qb.andWhere(`${dateExpr} >= :desde`, { desde: f.fechaDesde });
        if (f.fechaHasta) qb.andWhere(`${dateExpr} < :hastaExcl`, { hastaExcl: nextDay(f.fechaHasta) });

        // ── Empleado / estados ──
        if (f.empleadoId) qb.andWhere('pr.responsable_busqueda_id = :empleadoId', { empleadoId: f.empleadoId });
        if (f.estados?.length) qb.andWhere('pr.estado IN (:...estados)', { estados: f.estados });

        // ── Orden ──
        if (f.estadoOrdenId) qb.andWhere('o.current_status_id = :estadoOrdenId', { estadoOrdenId: f.estadoOrdenId });
        if (f.conOrden !== undefined) {
            qb.andWhere(f.conOrden ? 'pr.order_id IS NOT NULL' : 'pr.order_id IS NULL');
        }
        if (f.ordenEntregada !== undefined) {
            qb.andWhere(
                f.ordenEntregada
                    ? 'od.delivered_at IS NOT NULL'
                    : '(pr.order_id IS NOT NULL AND od.delivered_at IS NULL)',
            );
        }

        // ── Pago / litigio ──
        if (f.pago) qb.andWhere(`(${PAGO_CASE}) = :pago`, { pago: f.pago });
        if (f.litigio) qb.andWhere(`(${LITIGIO_CASE}) = :litigio`, { litigio: f.litigio });
        if (f.motivoCategoria) qb.andWhere('arr.motivo_categoria = :motivoCategoria', { motivoCategoria: f.motivoCategoria });

        // ── Proveedor / viajero ──
        if (f.providerId) qb.andWhere('s.provider_id = :providerId', { providerId: f.providerId });
        if (f.enviadoAViajero !== undefined) {
            qb.andWhere(f.enviadoAViajero ? TRAVEL_EXISTS : `NOT ${TRAVEL_EXISTS}`);
        }

        // ── Búsqueda (mismo criterio que listLitigios) ──
        const term = f.search?.trim();
        if (term) {
            const orderMatch = term.match(/^#(\d+)$/);
            const srMatch = !orderMatch ? term.match(/^(?:SR-?)?(\d{1,9})$/i) : null;
            const numero = srMatch ? parseInt(srMatch[1], 10) : null;
            const hasPrefix = /^SR/i.test(term);
            const text = '(pr.descripcion ILIKE :search OR pr.marca ILIKE :search OR pr.modelo ILIKE :search OR prov.nombre ILIKE :search)';

            if (orderMatch) {
                qb.andWhere('o.order_number = :orderNumber', { orderNumber: parseInt(orderMatch[1], 10) });
            } else if (numero !== null && hasPrefix) {
                qb.andWhere('pr.numero = :numero', { numero });
            } else if (numero !== null) {
                qb.andWhere(`(pr.numero = :numero OR ${text})`, { numero, search: `%${term}%` });
            } else {
                qb.andWhere(text, { search: `%${term}%` });
            }
        }

        return qb;
    }

    // ─────────────────────────────────────────────────────────────
    // Listado
    // ─────────────────────────────────────────────────────────────
    async list(f: NationalSourcingReportFilters, user: { companyId: string }) {
        const page = f.page && f.page > 0 ? f.page : 1;
        const limit = f.limit && f.limit > 0 ? Math.min(f.limit, 200) : 50;

        const base = this.baseQuery(user.companyId, f);
        const total = await base.clone().getCount();

        const qb = base.clone();
        const [first, ...rest] = LIST_COLUMNS;
        qb.select(first[0], first[1]);
        rest.forEach(([expr, alias]) => qb.addSelect(expr, alias));

        const [rows, filtros] = await Promise.all([
            qb
                .orderBy('fecha_encontrado', 'DESC', 'NULLS LAST')
                .addOrderBy('pr.id', 'DESC')
                .offset((page - 1) * limit)
                .limit(limit)
                .getRawMany(),
            this.getFilterOptions(user.companyId),
        ]);

        return {
            data: rows.map((r) => this.mapRow(r)),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            filtros,
        };
    }

    private mapRow(r: any) {
        const litigioEstado: string = r.litigio_estado;
        const hayLitigio = litigioEstado !== 'NINGUNO';

        // Mismo criterio que resolverLitigio/listLitigios: un litigio activo siempre debería tener estos 4 campos
        const datoInconsistente =
            litigioEstado === 'ACTIVO' &&
            (r.validacion_llegada !== 'LITIGIO' ||
                !r.motivo_categoria ||
                !r.motivo?.trim() ||
                !r.fecha_litigio);

        return {
            id: r.id,
            numero: r.numero ?? null,
            numero_formateado: formatPartRequestNumber(r.numero),
            descripcion: r.descripcion,
            marca: r.marca,
            modelo: r.modelo,
            estado: r.estado, // ojo: tras resolver un litigio el estado sigue siendo LITIGIO; ver litigio.estado

            fecha_solicitud: r.fecha_solicitud,
            fecha_encontrado: r.fecha_encontrado,
            fecha_llegada: r.fecha_llegada ?? null,

            encontrado_por: r.encontrado_por_id
                ? { id: r.encontrado_por_id, nombre: fullName(r.encontrado_por_nombre, r.encontrado_por_apellido) }
                : null,
            tecnico: r.tecnico_id
                ? { id: r.tecnico_id, nombre: fullName(r.tecnico_nombre, r.tecnico_apellido) }
                : null,

            proveedor: r.provider_id ? { id: r.provider_id, nombre: r.provider_nombre } : null,
            hallazgo: {
                precio: r.precio !== null ? Number(r.precio) : null,
                cantidad: r.cantidad,
                precio_transporte: r.precio_transporte !== null ? Number(r.precio_transporte) : null,
                precio_venta: r.precio_venta !== null ? Number(r.precio_venta) : null,
            },

            pago: {
                estado: r.pago_estado,
                monto_pagado: Number(r.monto_pagado),
                monto_total: Number(r.monto_total),
                ultimo_pago: r.ultimo_pago ?? null,
            },

            // Sin orden vinculada -> null (en blanco)
            orden: r.order_id
                ? {
                    id: r.order_id,
                    numero: r.order_number,
                    estado_id: r.order_status_id,
                    estado: r.order_status,
                    fecha_ingreso: r.order_entry_date,
                    entregada: !!r.order_delivered_at,
                    fecha_entrega: r.order_delivered_at ?? null,
                }
                : null,

            litigio: {
                estado: litigioEstado, // NINGUNO | ACTIVO | RESUELTO | CANCELADO_SIN_RESOLVER
                ...(hayLitigio && {
                    motivo_categoria: r.motivo_categoria ?? null,
                    motivo: r.motivo ?? null,
                    fecha_litigio: r.fecha_litigio ?? null,
                    fecha_resolucion: r.fecha_resolucion ?? null,
                    descripcion_resolucion: r.descripcion_resolucion ?? null,
                    resuelto_por: fullName(r.resuelto_por_nombre, r.resuelto_por_apellido),
                }),
            },

            validacion_llegada: r.validacion_llegada ?? null,
            enviado_a_viajero: r.viajero_estado !== null,
            viajero_estado: r.viajero_estado ?? null,
            dato_inconsistente: datoInconsistente,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Resumen por empleado (quien encontró)
    // ─────────────────────────────────────────────────────────────
    async summaryByEmployee(f: NationalSourcingReportFilters, user: { companyId: string }) {
        const base = this.baseQuery(user.companyId, f);

        const totals = await base
            .clone()
            .select('pr.responsable_busqueda_id', 'empleado_id')
            .addSelect('rb.first_name', 'nombre')
            .addSelect('rb.last_name', 'apellido')
            .addSelect('COUNT(*)', 'total')
            .addSelect('COUNT(*) FILTER (WHERE pr.order_id IS NOT NULL)', 'con_orden')
            .addSelect('COUNT(*) FILTER (WHERE od.delivered_at IS NOT NULL)', 'ordenes_entregadas')
            .addSelect(`COUNT(*) FILTER (WHERE (${PAGO_CASE}) = 'PAGADO')`, 'pagados')
            .addSelect(`COUNT(*) FILTER (WHERE (${PAGO_CASE}) = 'PARCIAL')`, 'pago_parcial')
            .addSelect(`COUNT(*) FILTER (WHERE (${PAGO_CASE}) = 'SIN_PAGO')`, 'sin_pago')
            .addSelect(`COUNT(*) FILTER (WHERE (${LITIGIO_CASE}) = 'ACTIVO')`, 'litigios_activos')
            .addSelect(`COUNT(*) FILTER (WHERE (${LITIGIO_CASE}) = 'RESUELTO')`, 'litigios_resueltos')
            .addSelect(`COUNT(*) FILTER (WHERE (${LITIGIO_CASE}) = 'CANCELADO_SIN_RESOLVER')`, 'litigios_cancelados')
            .addSelect(`COUNT(*) FILTER (WHERE pr.estado = '${S.CANCELADO}')`, 'cancelados')
            .addSelect(`SUM(${DUE})`, 'monto_total')
            .addSelect(`SUM(${PAID})`, 'monto_pagado')
            .groupBy('pr.responsable_busqueda_id')
            .addGroupBy('rb.first_name')
            .addGroupBy('rb.last_name')
            .orderBy('total', 'DESC')
            .getRawMany();

        // Desglose por estado de solicitud y por estado de la orden
        const breakdown = await base
            .clone()
            .select('pr.responsable_busqueda_id', 'empleado_id')
            .addSelect('pr.estado', 'estado')
            .addSelect('os.name', 'estado_orden')
            .addSelect('COUNT(*)', 'cantidad')
            .groupBy('pr.responsable_busqueda_id')
            .addGroupBy('pr.estado')
            .addGroupBy('os.name')
            .getRawMany();

        const porEmpleado = new Map<string, { solicitud: Record<string, number>; orden: Record<string, number> }>();
        for (const b of breakdown) {
            const entry = porEmpleado.get(b.empleado_id) ?? { solicitud: {}, orden: {} };
            const n = Number(b.cantidad);
            entry.solicitud[b.estado] = (entry.solicitud[b.estado] ?? 0) + n;
            const keyOrden = b.estado_orden ?? 'SIN_ORDEN';
            entry.orden[keyOrden] = (entry.orden[keyOrden] ?? 0) + n;
            porEmpleado.set(b.empleado_id, entry);
        }

        const num = (v: any) => Number(v ?? 0);
        const filtros = await this.getFilterOptions(user.companyId);

        return {
            filtros,
            data: totals.map((t) => ({
                empleado: { id: t.empleado_id, nombre: fullName(t.nombre, t.apellido) },
                total: num(t.total),
                con_orden: num(t.con_orden),
                ordenes_entregadas: num(t.ordenes_entregadas),
                pago: {
                    pagados: num(t.pagados),
                    parcial: num(t.pago_parcial),
                    sin_pago: num(t.sin_pago),
                },
                litigios: {
                    activos: num(t.litigios_activos),
                    resueltos: num(t.litigios_resueltos),
                    cancelados_sin_resolver: num(t.litigios_cancelados),
                },
                cancelados: num(t.cancelados),
                monto_total: num(t.monto_total),
                monto_pagado: num(t.monto_pagado),
                por_estado_solicitud: porEmpleado.get(t.empleado_id)?.solicitud ?? {},
                por_estado_orden: porEmpleado.get(t.empleado_id)?.orden ?? {},
            })),
        };
    }
}