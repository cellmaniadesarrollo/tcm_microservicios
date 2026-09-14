// gateway/src/orders/dto/create-part-request-gateway.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUrl, Min } from 'class-validator';

export class CreatePartRequestGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El orderId debe ser un número entero' })
    @Min(1, { message: 'El orderId debe ser un ID válido' })
    @IsNotEmpty({ message: 'El orderId es obligatorio' })
    orderId: number;

    @IsString({ message: 'La descripción debe ser un texto' })
    @IsNotEmpty({ message: 'La descripción es obligatoria' })
    descripcion: string;

    @IsString({ message: 'La marca debe ser un texto' })
    @IsNotEmpty({ message: 'La marca es obligatoria' })
    marca: string;

    @IsString({ message: 'El modelo debe ser un texto' })
    @IsNotEmpty({ message: 'El modelo es obligatorio' })
    modelo: string;

    @IsOptional()
    @IsString({ message: 'El modelo técnico debe ser un texto' })
    modeloTecnico?: string;

    @IsString({ message: 'El tipo debe ser un texto' })
    @IsNotEmpty({ message: 'El tipo es obligatorio' })
    tipo: string;

    @IsOptional()
    @IsString({ message: 'El color debe ser un texto' })
    color?: string;

    @IsOptional()
    @IsString({ message: 'La calidad debe ser un texto' })
    calidad?: string;

    @IsOptional()
    @IsArray({ message: 'Los posibles lugares deben ser una lista' })
    @IsString({ each: true, message: 'Cada elemento en posibles lugares debe ser una cadena de texto' })
    posiblesLugares?: string[];
}