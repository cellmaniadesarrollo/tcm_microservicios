// dto/update-order-extra-service.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateOrderExtraServiceDto } from './create-order-extra-service.dto';

export class UpdateOrderExtraServiceDto extends PartialType(
  OmitType(CreateOrderExtraServiceDto, ['order_id'] as const),
) {}