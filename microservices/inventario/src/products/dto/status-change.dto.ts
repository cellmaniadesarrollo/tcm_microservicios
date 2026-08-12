import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ProductStatus } from '../entities/product.entity';

export class StatusChangeDto {
  @ApiProperty({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  newStatus!: ProductStatus;

  @ApiProperty({ description: 'Razón del cambio de estado' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Observaciones adicionales' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ description: 'ID del usuario que realiza el cambio' })
  @IsOptional()
  @IsString()
  changedBy?: string;

  @ApiPropertyOptional({ description: 'Nombre del usuario que realiza el cambio' })
  @IsOptional()
  @IsString()
  changedByName?: string;
}