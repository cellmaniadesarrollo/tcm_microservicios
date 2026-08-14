import { ApiProperty } from '@nestjs/swagger';
import { ProductCondition, ProductStatus } from '../entities/product.entity';
// ❌ ELIMINAR ProductQuality

export class ProductResponseDto {
  @ApiProperty()
  _id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  brand!: string;

  @ApiProperty()
  model!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  color!: string;

  // ✅ CAMBIADO: quality como string sin enum
  @ApiProperty({ description: 'Calidad del producto', example: 'B' })
  quality!: string;

  @ApiProperty({ enum: ProductCondition })
  condition!: ProductCondition;

  @ApiProperty({ enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ required: false })
  observations?: string;

  @ApiProperty({ required: false })
  deviceId?: number;

  @ApiProperty({ required: false })
  categoryId?: string;

  @ApiProperty({ required: false })
  subcategoryId?: string;

  @ApiProperty({ required: false })
  purchasePrice?: number;

  @ApiProperty({ required: false })
  salePrice?: number;

  @ApiProperty()
  stockQuantity!: number;

  @ApiProperty()
  minStockThreshold!: number;

  @ApiProperty({ required: false })
  location?: string;

  @ApiProperty({ required: false })
  createdById?: string;

  @ApiProperty({ required: false })
  createdByName?: string;

  @ApiProperty()
  isLowStock!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromProduct(product: any): ProductResponseDto {
    return {
      _id: product._id,
      code: product.code,
      name: product.name,
      brand: product.brand,
      model: product.model,
      type: product.type,
      color: product.color,
      quality: product.quality,
      condition: product.condition,
      status: product.status,
      observations: product.observations,
      deviceId: product.deviceId,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      stockQuantity: product.stockQuantity,
      minStockThreshold: product.minStockThreshold || 0,
      location: product.location,
      createdById: product.createdById,
      createdByName: product.createdByName,
      isLowStock: product.isLowStock,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}