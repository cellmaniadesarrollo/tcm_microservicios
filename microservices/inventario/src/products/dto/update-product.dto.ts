import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ description: 'ID del usuario que actualiza' })
  @IsOptional()
  @IsString()
  lastUpdatedById?: string;

  @ApiPropertyOptional({ description: 'Nombre del usuario que actualiza' })
  @IsOptional()
  @IsString()
  lastUpdatedByName?: string;

  @ApiPropertyOptional({ description: 'Razón de la actualización' })
  @IsOptional()
  @IsString()
  updateReason?: string;
}