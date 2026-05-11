import { IsNumber } from 'class-validator';

export class GetOrderPaymentGatewayDto {
    @IsNumber()
    payment_id: number;
}