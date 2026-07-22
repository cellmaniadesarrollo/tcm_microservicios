// dto/create-order-extra-service.dto.ts
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderExtraServiceDto {
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

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    purchase_price?: number | null;
}