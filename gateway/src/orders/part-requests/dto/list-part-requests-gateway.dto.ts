import { IsOptional, IsInt, Min, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// Opcional: Define los estados permitidos si los conoces
export enum EstadoParte {
    PENDIENTE = 'PENDIENTE',
    APROBADO = 'APROBADO',
    RECHAZADO = 'RECHAZADO',
}

export class ListPartRequestsGatewayDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El número de página debe ser un entero' })
    @Min(1, { message: 'La página mínima es 1' })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El límite debe ser un entero' })
    @Min(1, { message: 'El límite mínimo es 1' })
    limit?: number = 10;

    @IsOptional()
    @IsString({ message: 'El término de búsqueda debe ser un texto' })
    search?: string;

    @IsOptional()
    @IsString({ message: 'El estado debe ser una cadena de texto' })
    // @IsEnum(EstadoParte, { message: 'El estado no es válido' }) // Descomenta si usas un Enum
    estado?: string;
}