// microservices/orders/src/order-part-requests/dto/aprobar-llegada.dto.ts
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    Min
} from 'class-validator';
import { Type } from 'class-transformer';

export class AprobarLlegadaGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;
    @Type(() => Number)
    @IsInt({ message: 'La cantidad para la orden debe ser un número entero' })
    @Min(1, { message: 'Debe asignarse al menos 1 unidad a la orden' })
    @IsNotEmpty({ message: 'La cantidad para la orden es obligatoria' })
    cantidadOrden: number;
}