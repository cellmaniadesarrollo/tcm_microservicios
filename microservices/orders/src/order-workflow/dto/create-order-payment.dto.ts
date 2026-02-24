// dto/create-order-payment.dto.ts
import { IsNumber, IsPositive, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateOrderPaymentDto {
    @IsInt()
    @Min(1)
    orderId: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    amount: number;

    @IsInt()
    @Min(1)
    paymentTypeId: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    paymentMethodId?: number | null;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    observation?: string;

    // NO incluimos flow_type → se fuerza a INGRESO
    // NO incluimos received_by_id → lo toma del usuario autenticado
}