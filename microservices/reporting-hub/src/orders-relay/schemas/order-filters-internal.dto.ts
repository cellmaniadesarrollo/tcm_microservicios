/**
 * Interfaz interna — usada por getDashboardDrill y llamadas service-to-service.
 * No pasa por class-validator, trabaja con Date objects nativos.
 */
export interface OrdersFilterInternalDto {
    status?: number[];
    orderType?: string[];
    branch?: string[];
    technician?: string[];
    receptionist?: string[];
    onlyWithPayments?: boolean;

    // Período de ingreso
    dateFrom?: Date;
    dateTo?: Date;

    // Período de finalización (status 7)
    endDateFrom?: Date;
    endDateTo?: Date;

    // Período de entrega (status 8)
    deliveryDateFrom?: Date;
    deliveryDateTo?: Date;

    page?: number;
    limit?: number;


}