//orders/dto/create-order-note-gateway.dto.ts
// ✅ Así debe quedar
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderNoteGatewayDto {
    @IsNumber()
    @IsNotEmpty()
    order_id: number;

    @IsString()
    @IsNotEmpty()
    note: string;

    @IsBoolean()
    @IsOptional()
    is_public?: boolean;
}