// microservices/orders/src/order-part-requests/dto/registrar-llegada.dto.ts

export interface RegistrarLlegadaDto {
    id: number;
    cantidad?: number;
    precioVenta?: number;
    marca?: string;
    modelo?: string;
    tipo?: string;
    color?: string;
    calidad?: string;
    observations?: string;
}