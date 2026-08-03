// microservices/notifications/src/order-audit/dto/create-order-audit.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsObject,
  IsDate,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TechnicianDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;
}

class MetadataDto {
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  changedBy?: string;
}

export class CreateOrderAuditDto {
  // 📦 Datos de la orden
  @IsNumber()
  @IsNotEmpty()
  orderId: number;

  @IsNumber()
  @IsNotEmpty()
  orderNumber: number;

  @IsString()
  @IsOptional()
  publicId?: string;

  // 👤 Quién hizo la acción
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  // 🎬 Acción realizada
  @IsString()
  @IsNotEmpty()
  action: string;

  // 📝 Detalles del cambio
  @IsObject()
  @IsOptional()
  oldValues?: any;

  @IsObject()
  @IsOptional()
  newValues?: any;

  // 📊 Estado de la orden
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  previousStatus?: string;

  // 👥 Técnicos
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicianDto)
  @IsOptional()
  technicians?: TechnicianDto[];

  // 🏢 Cliente
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsNumber()
  @IsOptional()
  customerId?: number;

  // 📱 Metadata
  @ValidateNested()
  @Type(() => MetadataDto)
  @IsOptional()
  metadata?: MetadataDto;

  // 📅 Timestamps
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;
}