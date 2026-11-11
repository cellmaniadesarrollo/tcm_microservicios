// microservices/orders/src/order-part-request/dto/national-sourcing-report.dto.ts

import { PartRequestStatus } from '../entities/enums/part-request-status.enum';

export type ReportFechaCampo = 'solicitud' | 'encontrado' | 'llegada' | 'entrega';
export type ReportPago = 'SIN_PAGO' | 'PARCIAL' | 'PAGADO';
export type ReportLitigio = 'NINGUNO' | 'ACTIVO' | 'RESUELTO' | 'CANCELADO_SIN_RESOLVER';

export interface NationalSourcingReportFilters {
    /** YYYY-MM-DD (inclusive) */
    fechaDesde?: string;
    /** YYYY-MM-DD (inclusive) */
    fechaHasta?: string;
    /** Sobre qué fecha aplica el rango. Default: 'encontrado' */
    fechaCampo?: ReportFechaCampo;

    /** Empleado que encontró el repuesto (= responsable_busqueda_id) */
    empleadoId?: string;

    estados?: PartRequestStatus[];

    /** order_statuses.id */
    estadoOrdenId?: number;
    conOrden?: boolean;
    ordenEntregada?: boolean;

    pago?: ReportPago;
    litigio?: ReportLitigio;
    motivoCategoria?: string;

    providerId?: number;
    enviadoAViajero?: boolean;

    /** "#123" = nº de orden, "SR-123"/"123" = nº de solicitud, otro = texto libre */
    search?: string;

    page?: number;
    limit?: number;
}