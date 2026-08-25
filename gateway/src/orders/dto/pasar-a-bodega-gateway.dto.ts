import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class PasarABodegaGatewayDto {
    @IsNotEmpty({ message: 'El id del pedido es obligatorio.' })
    @IsInt({ message: 'El id del pedido debe ser un número entero.' })
    @Min(1, { message: 'El id del pedido debe ser mayor a 0.' })
    orderId!: number;

    @IsOptional()
    @IsString({ message: 'La observación debe ser una cadena de texto.' })
    observation?: string;
}