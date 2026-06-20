import { Repository } from 'typeorm';

export abstract class OrdersBaseService {
    // Obliga a la clase que herede a tener este repositorio disponible
    protected abstract readonly attachmentRepository: Repository<any>;

    /**
     * Mapea las órdenes inyectando la propiedad has_attachments en sus pagos correspondientes
     */
    protected async appendPaymentAttachmentFlag<T extends { id: number; payments?: any[] }>(
        orders: T[],
        orderIds: number[],
    ): Promise<(T & { payments: (any & { has_attachments: boolean })[] })[]> {
        if (!orderIds.length) return orders as any;

        const paymentsWithAttachments = await this.attachmentRepository
            .createQueryBuilder('a')
            .select('a.entity_id', 'payment_id')
            .where('a.entity_type = :type', { type: 'PAYMENT' }) // Cambia por tu enum (ej: AttachmentEntityType.PAYMENT) si aplica
            .andWhere('a.is_active = true')
            .andWhere(
                `a.entity_id IN (
          SELECT p.id FROM order_payments p WHERE p.order_id IN (:...orderIds)
        )`,
                { orderIds },
            )
            .getRawMany<{ payment_id: number }>();

        const paymentIdsWithAttachments = new Set(
            paymentsWithAttachments.map((r) => r.payment_id),
        );

        return orders.map((order) => ({
            ...order,
            payments: order.payments?.map((payment) => ({
                ...payment,
                has_attachments: paymentIdsWithAttachments.has(payment.id),
            })) ?? [],
        })) as any;
    }
}