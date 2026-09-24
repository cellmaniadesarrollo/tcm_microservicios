// microservices/orders/src/order-discounts/dto/list-order-discounts.dto.ts
import { DiscountStatus } from '../entities/order-discount.entity';

export interface ListOrderDiscountsDto {
    orderId: number;
    status?: DiscountStatus;
}