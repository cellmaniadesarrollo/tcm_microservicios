// gateway/src/orders/dto/create-part-request-payment-gateway.dto.ts
import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartRequestPaymentGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;

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
}