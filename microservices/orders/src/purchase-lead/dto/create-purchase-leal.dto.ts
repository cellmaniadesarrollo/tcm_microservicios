import {
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsUUID,
  MaxLength,
  IsPositive,
} from 'class-validator';

export class CreatePurchaseLeadDto {
  // ─── Empresa / Sucursal ───────────────────────────────────────────────────

  @IsUUID()
  company_id!: string;

  @IsUUID()
  branch_id!: string;

  // ─── Cliente ──────────────────────────────────────────────────────────────

  @IsOptional()
  @IsNumber()
  customer_cache_id?: number; // si ya existe en cache, se pasa para copiar datos

  @IsString()
  @MaxLength(30)
  customer_id_number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  customer_id_type_name?: string;

  @IsString()
  @MaxLength(100)
  customer_first_name!: string;

  @IsString()
  @MaxLength(100)
  customer_last_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customer_phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  customer_email?: string;

  // ─── Dispositivo ──────────────────────────────────────────────────────────

  @IsOptional()
  @IsNumber()
  device_type_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_type_name?: string;

  @IsOptional()
  @IsNumber()
  brand_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand_name?: string;

  @IsOptional()
  @IsNumber()
  model_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  model_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_imei?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_storage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_condition?: string;

  // ─── Oferta ───────────────────────────────────────────────────────────────

  @IsOptional()
  @IsNumber()
  @IsPositive()
  offered_price?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimated_purchase_price?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}