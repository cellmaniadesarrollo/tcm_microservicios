// gateway/dto/update-order-extra-service-gateway.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateOrderExtraServiceGatewayDto } from './create-order-extra-service-gateway.dto';

export class UpdateOrderExtraServiceGatewayDto extends PartialType(
    OmitType(CreateOrderExtraServiceGatewayDto, ['order_id'] as const),
) { }