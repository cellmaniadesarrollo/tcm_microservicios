// microservices/orders/src/order-part-requests/dto/registrar-llegada.dto.ts
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrarLlegadaGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La cantidad debe ser un número entero' })
    @Min(1, { message: 'La cantidad mínima es 1' })
    cantidad?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio de venta debe ser un número válido' })
    @Min(0, { message: 'El precio de venta no puede ser negativo' })
    precioVenta?: number;

    @IsOptional()
    @IsString({ message: 'La marca debe ser un texto' })
    marca?: string;

    @IsOptional()
    @IsString({ message: 'El modelo debe ser un texto' })
    modelo?: string;

    @IsOptional()
    @IsString({ message: 'El tipo debe ser un texto' })
    tipo?: string;

    @IsOptional()
    @IsString({ message: 'El color debe ser un texto' })
    color?: string;

    @IsOptional()
    @IsString({ message: 'La calidad debe ser un texto' })
    calidad?: string;

    @IsOptional()
    @IsString({ message: 'Las observaciones deben ser texto' })
    observations?: string;
}