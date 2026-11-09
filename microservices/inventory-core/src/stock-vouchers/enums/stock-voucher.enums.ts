export enum VoucherDirection {
    OUT = 'OUT', // salida de bodega
    IN = 'IN',   // retorno a bodega
}

/**
 * OUT: el motivo exige / prohíbe vincular la salida a una orden.
 * IN : el vale de salida que se retorna debe (REQUIRED) o no debe (FORBIDDEN) estar vinculado a una orden.
 */
export enum ReasonOrderLink {
    REQUIRED = 'REQUIRED',
    FORBIDDEN = 'FORBIDDEN',
}

/** Estados de la orden (ms orders, valores de producción). */
export const ORDER_STATUS = {
    DELIVERED: 8,     // ENTREGADA: inmutable
    TO_WAREHOUSE: 9,  // PASAR A BODEGA
    IN_INVENTORY: 10, // EN INVENTARIO
} as const;

/** No se pueden vincular repuestos nuevos a la orden. */
export const ORDER_STATUSES_BLOCK_ISSUE: number[] = [
    ORDER_STATUS.DELIVERED, ORDER_STATUS.TO_WAREHOUSE, ORDER_STATUS.IN_INVENTORY,
];

/** No se pueden registrar retornos (la orden ya es inmutable). 9 y 10 SÍ: ahí se devuelve a bodega. */
export const ORDER_STATUSES_BLOCK_RETURN: number[] = [ORDER_STATUS.DELIVERED];