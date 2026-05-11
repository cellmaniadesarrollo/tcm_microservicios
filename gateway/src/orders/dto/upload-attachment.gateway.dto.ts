// src/orders/dto/upload-attachment.gateway.dto.ts
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

// Enum local solo para el gateway (no depende del MS)
export enum AttachmentEntityTypeGateway {
  FINDING = 'FINDING',
  PROCEDURE = 'PROCEDURE',
}

export class UploadAttachmentGatewayDto {
  @IsNumber()
  entityId: number;

  @IsEnum(AttachmentEntityTypeGateway)
  entityType: AttachmentEntityTypeGateway;

  @IsOptional()
  @IsString()
  customFileName?: string;
}