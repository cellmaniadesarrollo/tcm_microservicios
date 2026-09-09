// microservices/orders/src/order-part-requests/dto/aprobar-llegada.dto.ts

export interface AprobarLlegadaDto {
    id: number;
    precioVenta?: number; // fallback si no se puso en registrar-llegada
}