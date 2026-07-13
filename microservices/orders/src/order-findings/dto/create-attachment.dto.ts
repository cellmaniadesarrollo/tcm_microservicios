// order-findings/dto/create-attachment.dto.ts
import { IsEnum, IsInt, IsString, IsOptional, IsBoolean } from 'class-validator';
import { AttachmentEntityType } from '../entities/attachment.entity';

export class CreateAttachmentDto {
    @IsEnum(AttachmentEntityType)
    entity_type: AttachmentEntityType;

    @IsInt()
    entity_id: number;

    @IsString()
    file_name: string;

    @IsString()
    file_url: string;

    @IsString()
    file_type: string;

    @IsOptional()
    @IsBoolean()
    is_public?: boolean;
}