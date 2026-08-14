// microservicio-inventario/src/products/dto/create-product.dto.ts

import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsArray,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCondition, ProductStatus, ProductQuality } from '../entities/product.entity';

export class CreateProductDto {
  @ApiPropertyOptional({
    description: 'Código único del producto (opcional, se genera automáticamente)',
    example: 'INV-20260215-ABC123',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'El código solo puede contener letras mayúsculas, números y guiones',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'SKU único del producto (opcional, se genera automáticamente)',
    example: 'INS-UNI-TRA-INF00000000003230',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  // ✅ AGREGAR UPC
  @ApiPropertyOptional({
    description: 'UPC del producto (opcional, se genera automáticamente)',
    example: '00000000003230',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{14}$/, {
    message: 'El UPC debe tener exactamente 14 dígitos numéricos',
  })
  upc?: string;

  @ApiProperty({ description: 'Nombre del producto', example: 'iPhone 13 Pro Max' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Marca del producto', example: 'Apple' })
  @IsString()
  brand!: string;

  @ApiProperty({ description: 'Modelo del producto', example: 'A2487' })
  @IsString()
  model!: string;

  @ApiProperty({ description: 'Tipo de producto', example: 'SMARTPHONE' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Color del producto', example: 'GRAPHITE' })
  @IsString()
  color!: string;

  @ApiPropertyOptional({
    description: 'Calidad del producto',
    enum: ProductQuality,
    default: ProductQuality.B,
  })
  @IsOptional()
  @IsEnum(ProductQuality)
  quality?: ProductQuality;

  @ApiPropertyOptional({
    description: 'Condición del producto',
    enum: ProductCondition,
    default: ProductCondition.USADO,
  })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({
    description: 'Estado del producto',
    enum: ProductStatus,
    default: ProductStatus.ACTIVO,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Observaciones adicionales' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ description: 'ID del dispositivo relacionado' })
  @IsOptional()
  @IsNumber()
  deviceId?: number;

  @ApiPropertyOptional({ description: 'ID de la categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'ID de la subcategoría' })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional({ description: 'Precio de compra' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ description: 'Precio de venta' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional({ description: 'Cantidad en stock', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ description: 'Stock mínimo para alertas', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockThreshold?: number;

  @ApiPropertyOptional({ description: 'Ubicación en bodega' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'ID del creador' })
  @IsOptional()
  @IsString()
  createdById?: string;

  @ApiPropertyOptional({ description: 'Nombre del creador' })
  @IsOptional()
  @IsString()
  createdByName?: string;

  @ApiPropertyOptional({ description: 'URL de la imagen principal' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'URLs de imágenes adicionales' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'Días de garantía' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  warrantyDays?: number;

  @ApiPropertyOptional({ description: 'ID del proveedor' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Nombre del proveedor' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales' })
  @IsOptional()
  metadata?: Record<string, any>;
}