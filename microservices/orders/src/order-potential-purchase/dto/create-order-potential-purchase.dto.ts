// order-potential-purchase/dto/create-order-potential-purchase.dto.ts
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderPotentialPurchaseDto {
    @IsNumber()
    order_id!: number;

    @IsOptional()
    @IsString()
    observations?: string;

    internalToken!: string;

    user!: {
        userId: string;
        companyId: string;
    };
}