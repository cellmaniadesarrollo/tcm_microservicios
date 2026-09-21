// microservices/orders/src/order-part-requests/dto/no-aprobar-llegada.dto.ts

export interface NoAprobarLlegadaDto {
    id: number;
    motivoCategoria: 'PRODUCTO_INCORRECTO' | 'CALIDAD_DEFICIENTE' | 'DAÑADO_EN_TRANSITO' | 'CANTIDAD_INCOMPLETA' | 'OTRO'; // NUEVO
    motivoRechazo: string;
}