// update-order-finding-gateway.dto.ts
import { IsNumber, IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

export class UpdateOrderFindingGatewayDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_resolved?: boolean;
}