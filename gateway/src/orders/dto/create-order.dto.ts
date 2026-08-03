import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateOrderDto {

  // ----------------------------
  // Relaciones (IDs)
  // ----------------------------
  @IsNumber()
  order_type_id: number;

  @IsNumber()
  order_priority_id: number;

  @IsNumber()
  customer_id: number;

  @IsOptional()
  @IsNumber()
  device_id?: number;

  @IsOptional()
  @IsNumber()
  previous_order_id?: number;

  // ----------------------------
  // Técnicos asignados
  // ----------------------------
  @IsArray()
  @IsUUID('4', { each: true }) // 👈 valida cada elemento del array
  technician_ids: string[];

  // ----------------------------
  // Datos del ingreso
  // ----------------------------
  @IsOptional()
  @IsString()
  patron?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsBoolean()
  revisadoAntes: boolean;

  @IsString()
  detalleIngreso: string;
}
