import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductGatewayDto } from './create-product-gateway.dto';

export class UpdateProductGatewayDto extends PartialType(
    OmitType(CreateProductGatewayDto, ['productTypeId', 'trackingMode'] as const),
) { }