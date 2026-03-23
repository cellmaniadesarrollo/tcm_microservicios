// update-order-note.dto.ts
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrderNoteDto {
    @IsString()
    @MinLength(1)
    @IsOptional()
    note?: string;

    @IsBoolean()
    @IsOptional()
    is_public?: boolean;
}