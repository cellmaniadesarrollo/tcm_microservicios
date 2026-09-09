// gateway/src/orders/dto/no-aprobar-llegada-gateway.dto.ts
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NoAprobarLlegadaGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;

    @IsString({ message: 'El motivo de rechazo debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
    motivoRechazo: string;
}