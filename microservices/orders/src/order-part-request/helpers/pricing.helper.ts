// src/common/helpers/pricing.helper.ts

export interface PartRequest {
    precio_acordado?: number | string | null;
    precio_venta?: number | string | null;
}

/**
 * Precio que va a la orden y su origen: acordado primero; si no hay, el de venta.
 */
export function resolverPrecioOrden(pr: PartRequest): { precio: number; esAcordado: boolean } {
    const acordado = Number(pr.precio_acordado ?? 0);
    if (acordado > 0) return { precio: acordado, esAcordado: true };
    return { precio: Number(pr.precio_venta ?? 0), esAcordado: false };
}

/**
 * Precio que va a la orden (delegado en resolverPrecioOrden).
 */
export function precioParaOrden(pr: PartRequest): number {
    return resolverPrecioOrden(pr).precio;
}

/**
 * Costo unitario del viaje. paid_cost = total pagado. Null si no se informó costo (retiro ya pagado).
 */
export function costoUnitarioViaje(qty: number, paidCost: number | null): number | null {
    if (paidCost === null || !qty) return null;
    return Number((paidCost / qty).toFixed(2));
}