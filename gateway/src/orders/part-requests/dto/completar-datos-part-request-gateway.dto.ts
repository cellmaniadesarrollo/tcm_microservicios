import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CompletarDatosPartRequestGatewayDto {
    @IsOptional() // <-- Permite que el Body venga sin id desde HTTP
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    id?: number;

    @IsOptional()
    @IsString({ message: 'El modelo técnico debe ser texto' })
    modeloTecnico?: string;

    @IsOptional()
    @IsString({ message: 'El color debe ser texto' })
    color?: string;

    @IsOptional()
    @IsString({ message: 'La calidad debe ser texto' })
    calidad?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El precio de venta debe ser un número válido' })
    @Min(0.01, { message: 'El precio de venta debe ser mayor a 0' })
    precioVenta?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El precio acordado debe ser un número válido' })
    @Min(0.01, { message: 'El precio acordado debe ser mayor a 0' })
    precioAcordado?: number;   // ← nuevo
}