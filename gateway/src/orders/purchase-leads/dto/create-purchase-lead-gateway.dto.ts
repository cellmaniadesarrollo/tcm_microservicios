// dto/create-purchase-lead-gateway.dto.ts
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseLeadGatewayDto {
  // Cliente
  @IsOptional() @IsInt() @Type(() => Number)
  customer_cache_id?: number;

  @IsString() @MaxLength(30)
  customer_id_number!: string;

  @IsOptional() @IsString() @MaxLength(50)
  customer_id_type_name?: string;

  @IsString() @MaxLength(100)
  customer_first_name!: string;

  @IsString() @MaxLength(100)
  customer_last_name!: string;

  @IsOptional() @IsString() @MaxLength(20)
  customer_phone?: string;

  @IsOptional() @IsString() @MaxLength(150)
  customer_email?: string;

  // Dispositivo
  @IsOptional() @IsInt() @Type(() => Number)
  device_type_id?: number;

  @IsOptional() @IsString() @MaxLength(100)
  device_type_name?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  brand_id?: number;

  @IsOptional() @IsString() @MaxLength(255)
  brand_name?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  model_id?: number;

  @IsOptional() @IsString() @MaxLength(255)
  model_name?: string;

  @IsOptional() @IsString() @MaxLength(100)
  device_imei?: string;

  @IsOptional() @IsString() @MaxLength(50)
  device_color?: string;

  @IsOptional() @IsString() @MaxLength(50)
  device_storage?: string;

  @IsOptional() @IsString() @MaxLength(50)
  device_condition?: string;

  // Oferta
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  offered_price?: number;

  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  estimated_purchase_price?: number;

  @IsOptional() @IsString()
  notes?: string;
}