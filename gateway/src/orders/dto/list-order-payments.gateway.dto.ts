// list-order-payments.gateway.dto.ts
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum CashFlowDirection {
    INGRESO = 'INGRESO',
    EGRESO = 'EGRESO',
}

export class ListOrderPaymentsGatewayDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number;

    @IsOptional() @IsEnum(CashFlowDirection)
    flow_type?: CashFlowDirection;

    @IsOptional() @IsIn(['true', 'false'])
    is_verified?: 'true' | 'false';

    @IsOptional() @Type(() => Number) @IsInt()
    payment_type_id?: number;

    @IsOptional() @Type(() => Number) @IsInt()
    payment_method_id?: number;

    @IsOptional() @IsDateString()
    date_from?: string;

    @IsOptional() @IsDateString()
    date_to?: string;

    @IsOptional() @IsString()
    search?: string;
}