// gateway/src/orders/dto/encontrado-nacional-gateway.dto.ts
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Min
} from 'class-validator';
import { Type } from 'class-transformer';

export class EncontradoNacionalGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;

    @IsString({ message: 'El nombre del proveedor debe ser un texto' })
    @IsNotEmpty({ message: 'El proveedor es obligatorio' })
    proveedor: string;

    @Type(() => Number)
    @IsNumber({}, { message: 'El precio debe ser un número válido' })
    @Min(0, { message: 'El precio no puede ser negativo' })
    @IsNotEmpty({ message: 'El precio es obligatorio' })
    precio: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La cantidad debe ser un número entero' })
    @Min(1, { message: 'La cantidad mínima es 1' })
    cantidad?: number;

    @IsOptional()
    @IsString({ message: 'El contacto del proveedor debe ser texto' })
    contactoProveedor?: string;

    @IsOptional()
    @IsUrl({}, { message: 'El enlace de compra debe ser una URL válida' })
    linkCompra?: string;

    @IsOptional()
    @IsString({ message: 'Las notas deben ser texto' })
    notas?: string;
}