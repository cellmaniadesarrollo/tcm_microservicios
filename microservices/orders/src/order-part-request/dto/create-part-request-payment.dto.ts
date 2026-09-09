// microservices/orders/src/order-part-requests/dto/create-part-request-payment.dto.ts

export interface CreatePartRequestPaymentDto {
    id: number; // part_request_id
    monto: number;
    fechaPago?: string; // ISO date, opcional (default: ahora)
    notas?: string;
}