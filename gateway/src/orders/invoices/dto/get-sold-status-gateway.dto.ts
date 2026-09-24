// src/orders/invoices/dto/get-sold-status-gateway.dto.ts
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class GetSoldStatusGatewayDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    orderPublicIds!: string[];
}