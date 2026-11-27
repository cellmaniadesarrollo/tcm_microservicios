// dto/list-purchasable-orders-gateway.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListPurchasableOrdersGatewayDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number;

    @IsOptional() @IsString() @MaxLength(100)
    search?: string;

    @IsOptional() @IsIn(['all', 'purchased', 'not_purchased'])
    purchase_status?: 'all' | 'purchased' | 'not_purchased';
}