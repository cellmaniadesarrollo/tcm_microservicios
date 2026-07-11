// dto/create-order-pending-product.dto.ts
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderPendingProductDto {
    @IsInt()
    order_id!: number;

    @IsString()
    name_items!: string;

    @IsOptional() @IsInt() id_brand?: number;
    @IsOptional() @IsInt() id_model?: number;
    @IsOptional() @IsInt() id_type?: number;
    @IsOptional() @IsInt() id_color?: number;
    @IsOptional() @IsInt() id_quality?: number;

    @IsOptional() @IsString() observations?: string;

    @IsNumber()
    sale_price!: number;

    @IsOptional() @IsInt() @Min(1)
    quantity?: number;
}