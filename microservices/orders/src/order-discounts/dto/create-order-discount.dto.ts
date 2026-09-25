// microservices/orders/src/order-discounts/dto/create-order-discount.dto.ts
import { DiscountType } from '../entities/order-discount.entity';

export interface CreateOrderDiscountDto {
    orderId: number;
    discountType: DiscountType;
    discountValue: number;
    reason?: string;
}