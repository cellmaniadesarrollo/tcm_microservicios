// microservices/orders/src/order-part-requests/dto/list-part-requests.dto.ts

export interface ListPartRequestsDto {
    page?: number;
    limit?: number;
    search?: string;
    estado?: string;
}