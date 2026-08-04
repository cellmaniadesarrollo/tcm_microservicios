// src/notifications/dto/create-notification.dto.ts
import { 
  IsString, 
  IsNotEmpty, 
  IsEnum, 
  IsOptional, 
  IsUUID, 
  IsObject,
  IsDate 
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(['info', 'success', 'warning', 'error'])
  @IsOptional()
  type?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  // Campos de auditoría
  @IsString()
  @IsOptional()
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsObject()
  @IsOptional()
  oldValues?: any;

  @IsObject()
  @IsOptional()
  newValues?: any;

  @IsString()
  @IsOptional()
  actionDescription?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;
}