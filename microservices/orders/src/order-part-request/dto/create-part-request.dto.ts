// microservices/orders/src/order-part-requests/dto/create-part-request.dto.ts

export interface CreatePartRequestDto {
    orderId: number;
    descripcion: string;
    marca: string;
    modelo: string;
    modeloTecnico?: string;
    tipo: string;
    color?: string;
    calidad?: string;
    precioAcordado?: number;
    posiblesLugares?: string[];
}