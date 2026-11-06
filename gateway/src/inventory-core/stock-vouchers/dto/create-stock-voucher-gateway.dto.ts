import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

export class StockVoucherLineGatewayDto {
    /** SALIDA: lote del que sale. En un retorno NO se envía (vuelve al lote original). */
    @IsOptional()
    @IsUUID('4', { message: 'El lote no es válido' })
    lotId?: string;

    /** RETORNO: línea del vale de salida que se devuelve. */
    @IsOptional()
    @IsUUID('4', { message: 'La línea de origen no es válida' })
    originLineId?: string;

    @Type(() => Number)
    @IsInt({ message: 'La cantidad debe ser un entero' })
    @Min(1, { message: 'La cantidad debe ser mayor a 0' })
    @Max(100000)
    quantity!: number;

    /** Solo productos serializados: las unidades (IMEI/serial) que salen o regresan. Debe haber `quantity`. */
    @IsOptional()
    @IsArray({ message: 'Las unidades deben ser una lista' })
    @ArrayMaxSize(1000)
    @IsUUID('4', { each: true, message: 'Alguna unidad no es válida' })
    unitIds?: string[];
}

export class CreateStockVoucherGatewayDto {
    /** UUID generado por el front al abrir el formulario. Hace el guardado idempotente. */
    @IsUUID('4', { message: 'El identificador de solicitud no es válido' })
    clientRequestId!: string;

    /** Motivo (define si es salida o retorno y si lleva orden). */
    @IsUUID('4', { message: 'El motivo no es válido' })
    reasonId!: string;

    /** SALIDA: empleado que recibe. En un retorno se hereda del vale original. */
    @IsOptional()
    @IsUUID('4', { message: 'El empleado no es válido' })
    employeeId?: string;

    /** SALIDA con motivo que exige orden. En un retorno se hereda. */
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La orden no es válida' })
    @Min(1)
    orderId?: number;

    /** RETORNO: vale de salida que se devuelve. */
    @IsOptional()
    @IsUUID('4', { message: 'El vale de origen no es válido' })
    originVoucherId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'Agrega al menos una línea' })
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => StockVoucherLineGatewayDto)
    lines!: StockVoucherLineGatewayDto[];
}