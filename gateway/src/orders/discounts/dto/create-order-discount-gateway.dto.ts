import { IsEnum, IsNumber, IsString, Min, Max, IsNotEmpty } from 'class-validator';

export enum DiscountTypeDto {
    PORCENTAJE = 'PORCENTAJE',
    FIJO = 'FIJO',
}

export class CreateOrderDiscountGatewayDto {
    @IsEnum(DiscountTypeDto)
    tipo: DiscountTypeDto;

    @IsNumber()
    @Min(0.01)
    @Max(999999)
    valor: number;

    @IsString()
    @IsNotEmpty({ message: 'El motivo del descuento es obligatorio' })
    motivo: string;
}