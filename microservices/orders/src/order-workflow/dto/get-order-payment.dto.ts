import { IsNumber } from 'class-validator';

export class GetOrderPaymentDto {
    @IsNumber()
    payment_id: number;
}