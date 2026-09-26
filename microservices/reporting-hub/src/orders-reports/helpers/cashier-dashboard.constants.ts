/**
 * IDs de estado considerados PENDIENTES (en curso).
 * Excluye: 7 TRABAJO_FINALIZADO  y  8 ENTREGADA.
 */
export const CASHIER_PENDING_STATUS_IDS = [1, 2, 3, 4, 5, 6] as const;

/** ID del estado ENTREGADA. */
export const CASHIER_DELIVERED_STATUS_ID = 8 as const;

export const SERVICE_TECNICO_TYPE_ID = 1 as const;