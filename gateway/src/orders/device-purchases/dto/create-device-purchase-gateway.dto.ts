// gateway/src/orders/device-purchases/dto/create-device-purchase-gateway.dto.ts
import { Type } from 'class-transformer';
import {
    IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min,
} from 'class-validator';

export class CreateDevicePurchaseGatewayDto {
    @Type(() => Number) @IsInt() @Min(1)
    order_id!: number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    amount!: number;

    @Type(() => Number) @IsInt() @Min(1)
    payment_method_id!: number;

    @IsOptional() @IsString() @MaxLength(100)
    payment_reference?: string;

    @IsOptional() @IsDateString()
    paid_at?: string;

    @IsOptional() @IsString() @MaxLength(1000)
    notes?: string;
}