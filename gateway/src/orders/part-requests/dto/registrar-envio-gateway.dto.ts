// gateway/src/orders/dto/registrar-envio-gateway.dto.ts
import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrarEnvioGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;

    @IsString({ message: 'El transportista debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'El transportista es obligatorio' })
    transportista: string;

    @IsString({ message: 'El número de guía debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'El número de guía es obligatorio' })
    numeroGuia: string;

    @IsOptional()
    @IsDateString({}, { message: 'La fecha estimada de llegada debe tener un formato ISO 8601 válido (ej. YYYY-MM-DD)' })
    fechaEstimadaLlegada?: string;

    @IsOptional()
    @IsString({ message: 'Las notas deben ser texto' })
    notas?: string;
}