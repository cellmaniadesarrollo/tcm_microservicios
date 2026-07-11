// dto/update-order-pending-product.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateOrderPendingProductDto } from './create-order-pending-product.dto';

export class UpdateOrderPendingProductDto extends PartialType(
    OmitType(CreateOrderPendingProductDto, ['order_id'] as const),
) { }