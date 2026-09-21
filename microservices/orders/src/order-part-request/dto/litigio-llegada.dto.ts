// microservices/orders/src/order-part-requests/dto/litigio-llegada.dto.ts

export interface LitigioLlegadaDto {
    id: number;
    motivoCategoria: 'PRODUCTO_INCORRECTO' | 'CALIDAD_DEFICIENTE' | 'DAÑADO_EN_TRANSITO' | 'CANTIDAD_INCOMPLETA' | 'OTRO';
    motivo: string;
}