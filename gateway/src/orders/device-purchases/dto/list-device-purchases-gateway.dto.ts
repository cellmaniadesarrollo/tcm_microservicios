// gateway/src/orders/device-purchases/dto/list-device-purchases-gateway.dto.ts
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDevicePurchasesGatewayDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
    limit?: number;

    @IsOptional() @IsString()
    search?: string;

    @IsOptional() @IsDateString()
    from?: string;

    @IsOptional() @IsDateString()
    to?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    payment_method_id?: number;
}