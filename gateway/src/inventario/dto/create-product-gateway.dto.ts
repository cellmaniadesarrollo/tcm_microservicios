import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsEnum, 
  IsUUID, 
  IsArray,
  IsObject,
  Min,
  Matches 
} from 'class-validator';

export enum ProductCondition {
  NUEVO = 'NUEVO',
  OPEN_BOX = 'OPEN_BOX',
  RECONDICIONADO = 'RECONDICIONADO',
  USADO = 'USADO',
  DEMO = 'DEMO',
  REPARADO = 'REPARADO',
  REFURBISHED = 'REFURBISHED',
}

export enum ProductStatus {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  EN_REPARACION = 'EN_REPARACION',
  RESERVADO = 'RESERVADO',
  VENDIDO = 'VENDIDO',
}

export enum ProductQuality {
  A = 'A',
  B = 'B',
  C = 'C',
  RECONDICIONADO = 'RECONDICIONADO',
}

export class CreateProductGatewayDto {
  @ApiPropertyOptional({ example: 'INV-20260215-ABC123' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  code?: string;

  @ApiProperty({ example: 'iPhone 13 Pro Max' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Apple' })
  @IsString()
  brand!: string;

  @ApiProperty({ example: 'A2487' })
  @IsString()
  model!: string;

  @ApiProperty({ example: 'SMARTPHONE' })
  @IsString()
  type!: string;

  @ApiProperty({ example: 'GRAPHITE' })
  @IsString()
  color!: string;

  @ApiPropertyOptional({ enum: ProductQuality, default: ProductQuality.B })
  @IsOptional()
  @IsEnum(ProductQuality)
  quality?: ProductQuality;

  @ApiPropertyOptional({ enum: ProductCondition, default: ProductCondition.USADO })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.ACTIVO })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deviceId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  warrantyDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;

  // ============================================
  // 🆕 CAMPOS AGREGADOS
  // ============================================

  @ApiPropertyOptional({ description: 'ID del usuario que crea el producto' })
  @IsOptional()
  @IsString()
  createdById?: string;

  @ApiPropertyOptional({ description: 'Nombre del usuario que crea el producto' })
  @IsOptional()
  @IsString()
  createdByName?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales del producto' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'ID del usuario que actualiza el producto' })
  @IsOptional()
  @IsString()
  lastUpdatedById?: string;

  @ApiPropertyOptional({ description: 'Nombre del usuario que actualiza el producto' })
  @IsOptional()
  @IsString()
  lastUpdatedByName?: string;

  @ApiPropertyOptional({ description: 'Razón de la actualización' })
  @IsOptional()
  @IsString()
  updateReason?: string;
}