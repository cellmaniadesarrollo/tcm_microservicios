// gateway/dto/create-order-extra-service-gateway.dto.ts
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderExtraServiceGatewayDto {
    @IsInt()
    order_id!: number;

    @IsInt()
    service_type_id!: number;

    @IsOptional() @IsString()
    description?: string;

    @IsNumber()
    unit_price!: number;

    @IsOptional() @IsInt() @Min(1)
    quantity?: number;
}