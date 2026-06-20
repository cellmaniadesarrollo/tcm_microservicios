// dto/verify-order-payment.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class VerifyOrderPaymentGatewayDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    paymentId!: number;
}