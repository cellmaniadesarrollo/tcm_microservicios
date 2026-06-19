// dto/get-payment-signed-urls-gateway.dto.ts
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GetPaymentSignedUrlsGatewayDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    paymentId!: number;
}