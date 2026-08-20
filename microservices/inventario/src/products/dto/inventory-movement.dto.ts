import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min } from 'class-validator';

export enum MovementType {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
}

export class InventoryMovementDto {
  @ApiProperty({ description: 'Cantidad a mover' })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  movementType!: MovementType;

  @ApiProperty({ description: 'Razón del movimiento' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'ID del usuario que realiza el movimiento' })
  @IsOptional()
  @IsString()
  performedBy?: string;

  @ApiPropertyOptional({ description: 'Nombre del usuario que realiza el movimiento' })
  @IsOptional()
  @IsString()
  performedByName?: string;

  @ApiPropertyOptional({ description: 'ID de la orden relacionada' })
  @IsOptional()
  @IsUUID()
  relatedOrderId?: string;

  @ApiPropertyOptional({ description: 'ID del dispositivo relacionado' })
  @IsOptional()
  @IsNumber()
  relatedDeviceId?: number;

  @ApiPropertyOptional({ description: 'Observaciones adicionales' })
  @IsOptional()
  @IsString()
  observations?: string;
}