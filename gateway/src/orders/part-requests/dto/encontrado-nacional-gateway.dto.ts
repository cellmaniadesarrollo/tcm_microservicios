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

    // ─── Precio de venta (opcional aquí, obligatorio recién al aprobar) ──
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El precio de venta debe ser un número válido' })
    @Min(0.01, { message: 'El precio de venta debe ser mayor a 0' })
    precioVenta?: number;

    // ─── Datos bancarios (obligatorios: aquí se pasa a espera de pago) ──
    @IsString({ message: 'El banco debe ser texto' })
    @IsNotEmpty({ message: 'El banco es obligatorio' })
    banco: string;

    @IsString({ message: 'El número de cuenta debe ser texto' })
    @IsNotEmpty({ message: 'El número de cuenta es obligatorio' })
    numeroCuenta: string;

    @IsString({ message: 'El tipo de cuenta debe ser texto' })
    @IsNotEmpty({ message: 'El tipo de cuenta es obligatorio' })
    tipoCuenta: string;

    @IsString({ message: 'El titular de la cuenta debe ser texto' })
    @IsNotEmpty({ message: 'El titular de la cuenta es obligatorio' })
    titularCuenta: string;
    @IsOptional()
    @IsNumber()
    precioTransporte?: number;
}