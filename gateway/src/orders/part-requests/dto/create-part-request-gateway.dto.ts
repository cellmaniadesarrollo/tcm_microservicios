// gateway/src/orders/dto/create-part-request-gateway.dto.ts
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUrl } from 'class-validator';

export class CreatePartRequestGatewayDto {
    @IsInt({ message: 'El orderId debe ser un número entero' })
    @IsPositive({ message: 'El orderId debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El orderId es requerido' })
    orderId: number;

    @IsString({ message: 'La descripción debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'La descripción es requerida' })
    descripcion: string;

    // opcional: links sugeridos por el técnico al momento de pedir
    @IsOptional()
    @IsArray({ message: 'posiblesLugares debe ser una lista' })
    @IsString({ each: true, message: 'Cada elemento de posiblesLugares debe ser un texto' })
    // Nota: Si necesitas validar que sean URLs estrictas, reemplaza @IsString por:
    // @IsUrl({}, { each: true, message: 'Cada lugar debe ser una URL válida' })
    posiblesLugares?: string[];
}