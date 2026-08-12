import { PartialType } from '@nestjs/swagger';
import { CreateProductGatewayDto } from './create-product-gateway.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProductGatewayDto extends PartialType(CreateProductGatewayDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastUpdatedById?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastUpdatedByName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  updateReason?: string;
}
