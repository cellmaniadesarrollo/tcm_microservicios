// src/orders/invoices/dto/resend-invoice-gateway.dto.ts
import { IsNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ResendInvoiceGatewayDto {
    @IsNotEmpty()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    invoiceId!: number;
}