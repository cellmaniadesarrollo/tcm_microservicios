// microservices/orders/src/order-part-requests/dto/create-part-request-payment.dto.ts

export interface CreatePartRequestPaymentDto {
    providerId: number;
    monto: number;
    fechaPago?: string;
    notas?: string;

    asignaciones: {
        partRequestId: number;
        montoAsignado: number;
        cantidadOrden?: number; // 0 o ausente si esa solicitud no está vinculada a una orden
    }[];
}