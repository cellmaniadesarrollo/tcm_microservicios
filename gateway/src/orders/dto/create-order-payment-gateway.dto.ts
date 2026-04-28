// dto/create-order-payment-gateway.dto.ts
import { IsNumber, IsPositive, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateOrderPaymentGatewayDto {
    @IsInt()
    @Min(1)
    orderId: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive({ message: 'El monto debe ser mayor que cero' })
    amount: number;

    @IsInt()
    @Min(1)
    paymentTypeId: number;

    @IsOptional()
    @IsInt()
    paymentMethodId?: number | null = null;

    @IsOptional()
    @IsString()
    @IsString({ message: 'La referencia debe ser texto' })
    reference?: string;

    @IsOptional()
    @IsString()
    observation?: string;
}