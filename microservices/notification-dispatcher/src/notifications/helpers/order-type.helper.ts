import { OrderReplica } from '../../orders-relay/entities/order-replica.entity';

export const ALLOWED_ORDER_TYPES = new Set(['PERSONALIZADO', 'SERVICIO TECNICO']);

export function isNotifiableOrder(order: OrderReplica): boolean {
    return ALLOWED_ORDER_TYPES.has(order.typeName?.trim().toUpperCase() ?? '');
}