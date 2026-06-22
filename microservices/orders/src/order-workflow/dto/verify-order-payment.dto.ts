// dto/verify-order-payment.dto.ts
import { IsInt, IsString, Min } from 'class-validator';

export class VerifyOrderPaymentDto {
    @IsInt()
    @Min(1)
    paymentId!: number;

    @IsString()
    companyId!: string;

    @IsString()
    verifiedById!: string;
}