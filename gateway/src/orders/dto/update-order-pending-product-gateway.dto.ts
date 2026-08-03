// gateway/dto/update-order-pending-product-gateway.dto.ts
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateOrderPendingProductGatewayDto {
    @IsOptional() @IsString() name_items?: string;
    @IsOptional() @IsInt() id_brand?: number;
    @IsOptional() @IsInt() id_model?: number;
    @IsOptional() @IsInt() id_type?: number;
    @IsOptional() @IsInt() id_color?: number;
    @IsOptional() @IsInt() id_quality?: number;
    @IsOptional() @IsString() observations?: string;
    @IsOptional() @IsNumber() sale_price?: number;
    @IsOptional() @IsNumber() @Min(0) purchase_price?: number;
    @IsOptional() @IsInt() @Min(1) quantity?: number;
}