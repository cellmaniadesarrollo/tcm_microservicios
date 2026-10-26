/** De dónde nace un lote. Sin FK: así stock no depende de receipts ni de otros módulos. */
export enum LotOriginType {
    RECEIPT = 'RECEIPT',       // línea de un ingreso
    ADJUSTMENT = 'ADJUSTMENT', // ajuste de inventario
    RETURN = 'RETURN',         // devolución que no vuelve a su lote original
    OPENING = 'OPENING',       // saldo inicial
}

export enum UnitStatus {
    AVAILABLE = 'AVAILABLE',
    RESERVED = 'RESERVED',
    SOLD = 'SOLD',
    CONSUMED = 'CONSUMED',     // usada en una orden de reparación
    RETURNED = 'RETURNED',
}

export enum MovementType {
    RECEIPT_IN = 'RECEIPT_IN',
    RECEIPT_VOID = 'RECEIPT_VOID',
    SALE_OUT = 'SALE_OUT',
    REPAIR_CONSUMPTION = 'REPAIR_CONSUMPTION',
    TRANSFER_OUT = 'TRANSFER_OUT',
    TRANSFER_IN = 'TRANSFER_IN',
    ADJUSTMENT = 'ADJUSTMENT',
    RETURN_IN = 'RETURN_IN',
}