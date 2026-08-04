// gateway/orders/dto/mark-potential-purchase-gateway.dto.ts
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class MarkPotentialPurchaseGatewayDto {
    @IsNumber()
    order_id!: number;

    @IsOptional()
    @IsString()
    observations?: string;
}