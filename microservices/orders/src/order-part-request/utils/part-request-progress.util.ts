// microservices/orders/src/order-part-requests/part-request-progress.util.ts
import { PartRequestStatus } from '../entities/enums/part-request-status.enum';

export type StepStatus = 'COMPLETADO' | 'ACTUAL' | 'PENDIENTE';
export type RutaSolicitud = 'NACIONAL' | 'PERSONAL' | null;

export interface ProgressStep {
    key: string;
    label: string;
    status: StepStatus;
    fecha: Date | null;
    grupo: 'SOLICITUD' | 'ORDEN';
}

const S = PartRequestStatus;

export const ESTADO_LABELS: Record<string, string> = {
    [S.SOLICITADO]: 'Solicitado',
    [S.EN_BUSQUEDA_PERSONAL]: 'En búsqueda personal',
    [S.ESPERA_DE_PAGO]: 'Espera de pago',
    [S.EN_PROCESO_DE_PEDIDO]: 'En proceso de pedido',
    [S.LLEGADO_PENDIENTE_VALIDACION]: 'Llegado, pendiente de validación',
    [S.LLEGADO_ASIGNADO]: 'Llegada aprobada y asignada',
    [S.PENDIENTE_INGRESO]: 'Pendiente de ingreso',
    [S.INGRESADO_ASIGNADO]: 'Ingresado y asignado',
    [S.LITIGIO]: 'En litigio',
    [S.CANCELADO]: 'Cancelado',
    LITIGIO_RESUELTO: 'Litigio resuelto',
    DEFINIR_RUTA: 'Compra nacional o búsqueda personal',
};

/**
 * Estados de la orden por NOMBRE (los ids pueden variar entre desarrollo y producción).
 * Las claves están normalizadas: mayúsculas, sin tildes, espacios → "_".
 *
 *  INGRESADO, VISTA, EN REVISION, EN ESPERA APROBACION, EN BUSQUEDA REPUESTO,
 *  EN REPARACION, TRABAJO FINALIZADO, ENTREGADA, PASAR A BODEGA
 *
 * PASAR_A_BODEGA es una rama lateral: rank 0, no cuenta como avance.
 */
const ORDER_RANK: Record<string, number> = {
    INGRESADO: 1,
    VISTA: 2,
    EN_REVISION: 3,
    EN_ESPERA_APROBACION: 4,
    EN_BUSQUEDA_REPUESTO: 5,
    EN_REPARACION: 6,
    TRABAJO_FINALIZADO: 7,
    ENTREGADA: 8,
    PASAR_A_BODEGA: 0,
};

// Pasos de la orden que se muestran en el stepper
const ORDER_STEPS = [
    { key: 'ORDEN_TRABAJO_FINALIZADO', label: 'Trabajo finalizado', rank: ORDER_RANK.TRABAJO_FINALIZADO },
    { key: 'ORDEN_ENTREGADA', label: 'Orden entregada', rank: ORDER_RANK.ENTREGADA },
];

const normalizar = (s: string) =>
    s
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');

/** Rango de la orden según el nombre de su estado. 0 = desconocido o rama lateral. */
export function rankDeOrden(nombre?: string | null): number {
    const n = normalizar(nombre ?? '');
    if (!n) return 0;
    if (n in ORDER_RANK) return ORDER_RANK[n];
    // Tolerancia ante variaciones (ENTREGADO, FINALIZADA, etc.)
    if (n.includes('BODEGA')) return 0;
    if (n.includes('ENTREGAD')) return ORDER_RANK.ENTREGADA;
    if (n.includes('FINALIZAD')) return ORDER_RANK.TRABAJO_FINALIZADO;
    return 0;
}

interface HistorialLike {
    estado_nuevo: PartRequestStatus;
    fecha: Date;
}

/** El historial debe venir ordenado ASC por fecha. */
export function detectarRuta(historial: HistorialLike[]): RutaSolicitud {
    for (let i = historial.length - 1; i >= 0; i--) {
        const e = historial[i].estado_nuevo;
        if (e === S.ESPERA_DE_PAGO || e === S.EN_PROCESO_DE_PEDIDO) return 'NACIONAL';
        if (e === S.EN_BUSQUEDA_PERSONAL) return 'PERSONAL';
    }
    return null;
}

export function buildProgress(input: {
    estado: PartRequestStatus;
    order_id?: number | null;
    historial: HistorialLike[];
    arrival?: { resuelto?: boolean } | null;
    orderStatusName?: string | null;
}) {
    const { estado, historial } = input;
    const tieneOrden = !!input.order_id;
    const ruta = detectarRuta(historial);
    const enLitigio = estado === S.LITIGIO;

    // Sin orden → la solicitud termina por inventario. Con orden termina en LLEGADO_ASIGNADO.
    const pasoPorInventario =
        historial.some(
            (h) =>
                h.estado_nuevo === S.PENDIENTE_INGRESO || h.estado_nuevo === S.INGRESADO_ASIGNADO,
        ) ||
        estado === S.PENDIENTE_INGRESO ||
        estado === S.INGRESADO_ASIGNADO;
    const usaInventario = !tieneOrden || pasoPorInventario;

    // ─── Pasos de la solicitud ───
    const keys: string[] = [S.SOLICITADO];
    if (ruta === 'NACIONAL') keys.push(S.ESPERA_DE_PAGO, S.EN_PROCESO_DE_PEDIDO);
    else if (ruta === 'PERSONAL') keys.push(S.EN_BUSQUEDA_PERSONAL);
    else keys.push('DEFINIR_RUTA');
    keys.push(S.LLEGADO_PENDIENTE_VALIDACION, S.LLEGADO_ASIGNADO);
    if (usaInventario) keys.push(S.PENDIENTE_INGRESO, S.INGRESADO_ASIGNADO);

    const ultimoSolicitud = keys[keys.length - 1];
    const solicitudCompleta = estado === ultimoSolicitud;

    // Un litigio elimina la asignación a la orden
    const noAlcanzables = new Set<string>(
        enLitigio ? [S.LLEGADO_ASIGNADO, S.PENDIENTE_INGRESO, S.INGRESADO_ASIGNADO] : [],
    );

    const reached = new Set<string>([S.SOLICITADO]);
    const fechas = new Map<string, Date>();
    for (const h of historial) {
        if (!noAlcanzables.has(h.estado_nuevo)) reached.add(h.estado_nuevo);
        fechas.set(h.estado_nuevo, h.fecha);
    }

    const pasosSolicitud: ProgressStep[] = keys.map((key) => {
        let status: StepStatus;
        if (key === estado) status = key === ultimoSolicitud ? 'COMPLETADO' : 'ACTUAL';
        else status = reached.has(key) ? 'COMPLETADO' : 'PENDIENTE';
        return {
            key,
            label: ESTADO_LABELS[key] ?? key,
            status,
            fecha: status === 'PENDIENTE' ? null : fechas.get(key) ?? null,
            grupo: 'SOLICITUD',
        };
    });

    // ─── Pasos de la orden (solo si hay orden) ───
    const ordenRank = rankDeOrden(input.orderStatusName);
    let actualAsignado = false;

    const pasosOrden: ProgressStep[] = tieneOrden
        ? ORDER_STEPS.map((o) => {
            let status: StepStatus = 'PENDIENTE';
            if (solicitudCompleta) {
                if (ordenRank >= o.rank) status = 'COMPLETADO';
                else if (!actualAsignado) {
                    status = 'ACTUAL';
                    actualAsignado = true;
                }
            }
            return { key: o.key, label: o.label, status, fecha: null, grupo: 'ORDEN' as const };
        })
        : [];

    const pasos = [...pasosSolicitud, ...pasosOrden];

    const litigioResuelto = enLitigio && !!input.arrival?.resuelto;
    const cancelado = estado === S.CANCELADO;
    const completados = pasos.filter((p) => p.status === 'COMPLETADO').length;
    const exito = !cancelado && !enLitigio && completados === pasos.length;
    const cerrada = exito || cancelado || litigioResuelto;

    let faltantes: string[] = [];
    if (enLitigio && !litigioResuelto) faltantes = ['Resolver litigio'];
    else if (!cerrada) faltantes = pasos.filter((p) => p.status !== 'COMPLETADO').map((p) => p.label);

    const estado_visual = litigioResuelto ? 'LITIGIO_RESUELTO' : estado;

    return {
        ruta,
        pasos,
        completados,
        total: pasos.length,
        porcentaje: Math.round((completados / pasos.length) * 100),
        pasos_faltantes: faltantes,
        completada: solicitudCompleta, // la parte de la solicitud terminó
        exito,                         // solicitud + orden entregada (éxito total)
        cerrada,
        estado_visual,
        estado_visual_label: ESTADO_LABELS[estado_visual] ?? estado_visual,
    };
}