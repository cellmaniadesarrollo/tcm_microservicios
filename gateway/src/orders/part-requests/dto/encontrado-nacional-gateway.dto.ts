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

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El ID del proveedor debe ser un número entero' })
    @Min(1, { message: 'El ID del proveedor debe ser mayor a 0' })
    providerId?: number;

    @IsOptional()
    @IsString({ message: 'El nombre del proveedor debe ser un texto' })
    proveedor?: string;

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

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El precio de venta debe ser un número válido' })
    @Min(0.01, { message: 'El precio de venta debe ser mayor a 0' })
    precioVenta?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El precio de transporte debe ser un número válido' })
    @Min(0, { message: 'El precio de transporte no puede ser negativo' })
    precioTransporte?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El ID de la cuenta del proveedor debe ser un número entero' })
    @Min(1, { message: 'El ID de la cuenta del proveedor debe ser mayor a 0' })
    providerAccountId?: number;

    // ─── Datos bancarios (opcionales) ─────────────────────────
    @IsOptional()
    @IsString({ message: 'El banco debe ser texto' })
    banco?: string;

    @IsOptional()
    @IsString({ message: 'El número de cuenta debe ser texto' })
    numeroCuenta?: string;

    @IsOptional()
    @IsString({ message: 'El tipo de cuenta debe ser texto' })
    tipoCuenta?: string;

    @IsOptional()
    @IsString({ message: 'El titular de la cuenta debe ser texto' })
    titularCuenta?: string;
}