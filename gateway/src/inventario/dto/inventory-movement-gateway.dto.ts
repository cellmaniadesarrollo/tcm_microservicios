import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min } from 'class-validator';

export enum MovementType {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
}

export class InventoryMovementGatewayDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  movementType!: MovementType;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  performedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  performedByName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  relatedDeviceId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}
