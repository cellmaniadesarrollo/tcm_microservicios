// microservices/orders/src/order-discounts/dto/cancel-order-discount.dto.ts
export interface CancelOrderDiscountDto {
    orderId: number;
    discountId: number;
    cancelledReason?: string;
}