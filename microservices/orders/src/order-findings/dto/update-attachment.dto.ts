// order-findings/dto/update-attachment.dto.ts
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateAttachmentDto {
    @IsOptional()
    @IsString()
    file_name?: string;

    @IsOptional()
    @IsString()
    file_url?: string;

    @IsOptional()
    @IsString()
    file_type?: string;

    @IsOptional()
    @IsBoolean()
    is_public?: boolean;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}