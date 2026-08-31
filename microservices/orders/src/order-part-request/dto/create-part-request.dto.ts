// microservices/orders/src/order-part-requests/dto/create-part-request.dto.ts

export interface CreatePartRequestDto {
    orderId: number;
    descripcion: string;
    posiblesLugares?: string[];
}