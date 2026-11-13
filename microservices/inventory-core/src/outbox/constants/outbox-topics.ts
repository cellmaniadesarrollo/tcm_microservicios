export const INVENTORY_CORE_ORIGIN = 'inventory-core';

export const SPARE_TOPICS = {
    ASSIGNED: 'ms.inventory.spare.assigned',
    RETURNED: 'ms.inventory.spare.returned',     // fase 2
    CANCELLED: 'ms.inventory.spare.cancelled',   // fase 3
} as const;

export const SPARE_EVENTS = {
    ASSIGNED: 'SPARE_ASSIGNED',
    RETURNED: 'SPARE_RETURNED',
    CANCELLED: 'SPARE_CANCELLED',
} as const;

export const PRODUCT_TOPICS = {
    UPSERTED: 'ms.inventory.core.product.upserted',
} as const;

export const PRODUCT_EVENTS = {
    UPSERTED: 'PRODUCT_UPSERTED',
} as const;

export const LOT_TOPICS = {
    UPSERTED: 'ms.inventory.core.lot.upserted',
} as const;

export const LOT_EVENTS = {
    UPSERTED: 'LOT_UPSERTED',
} as const;