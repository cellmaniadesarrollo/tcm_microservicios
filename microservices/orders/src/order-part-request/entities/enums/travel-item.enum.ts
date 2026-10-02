// microservices/orders/src/order-part-requests/entities/enums/travel-item.enum.ts

export enum TravelItemMode {
    BUY_CASH = 'BUY_CASH',
    PICKUP_PAID = 'PICKUP_PAID',
}

export enum TravelItemStatus {
    PENDIENTE = 'PENDIENTE',
    RECOGIDO = 'RECOGIDO',
    NO_ENCONTRADO = 'NO_ENCONTRADO',
    CANCELADO = 'CANCELADO',
}