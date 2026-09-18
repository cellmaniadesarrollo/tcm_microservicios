// gateway/src/orders/dto/create-part-request-payment-gateway.dto.ts
import {
    IsArray,
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AsignacionPagoDto {
    @Type(() => Number)
    @IsInt({ message: 'El partRequestId debe ser un número entero' })
    @Min(1, { message: 'El partRequestId debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El partRequestId es obligatorio' })
    partRequestId: number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto asignado debe ser un número válido con hasta 2 decimales' })
    @Min(0.01, { message: 'El monto asignado mínimo es 0.01' })
    @IsNotEmpty({ message: 'El monto asignado es obligatorio' })
    montoAsignado: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La cantidad de la orden debe ser un número entero' })
    @IsPositive({ message: 'La cantidad de la orden debe ser mayor a 0' })
    cantidadOrden?: number;
}

export class CreatePartRequestPaymentGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID del proveedor debe ser un número entero' })
    @Min(1, { message: 'El ID del proveedor debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID del proveedor es obligatorio' })
    providerId: number;   // o 'id' según hayas decidido

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número válido con hasta 2 decimales' })
    @Min(0.01, { message: 'El monto mínimo a registrar es 0.01' })
    @IsNotEmpty({ message: 'El monto es obligatorio' })
    monto: number;

    @IsOptional()
    @IsDateString({}, { message: 'La fecha de pago debe tener un formato ISO 8601 válido (ej. YYYY-MM-DD)' })
    fechaPago?: string;

    @IsOptional()
    @IsString({ message: 'Las notas deben ser texto' })
    notas?: string;

    @IsOptional()
    @IsArray({ message: 'Las asignaciones deben ser un arreglo' })
    @ValidateNested({ each: true })
    @Type(() => AsignacionPagoDto)
    asignaciones?: AsignacionPagoDto[];
}