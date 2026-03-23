// update-order-note-gateway.dto.ts
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrderNoteGatewayDto {
    @IsString()
    @MinLength(1)
    @IsOptional()
    note?: string;

    @IsBoolean()
    @IsOptional()
    is_public?: boolean;
}