import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class SaveInboundDto {
    @IsString() @IsOptional()
    inbound_tracking?: string;

    @IsString() @IsOptional()
    inbound_courier?: string;

    @Transform(({ value }) => value != null ? Number(value) : value)
    @IsNumber() @IsOptional()
    inbound_origin_id?: number;

    @IsString() @IsOptional()
    inbound_sender_address?: string;

    @Transform(({ value }) => value != null && value !== '' ? Number(value) : undefined)
    @IsNumber() @IsOptional()
    inbound_shipping_cost?: number;

    @IsString() @IsOptional()
    inbound_notes?: string;

    @IsString() @IsOptional()
    notes?: string;
}