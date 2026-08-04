import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class SaveOutboundDto {
    @IsString() @IsOptional() outbound_tracking?: string;
    @IsString() @IsOptional() outbound_courier?: string;
    @IsNumber() @IsOptional() outbound_dest_id?: number;
    @IsString() @IsOptional() outbound_address?: string;
    @IsNumber() @IsOptional() outbound_shipping_cost?: number;
    @IsDateString() @IsOptional() outbound_sent_at?: string;
    @IsString() @IsOptional() outbound_notes?: string;
}