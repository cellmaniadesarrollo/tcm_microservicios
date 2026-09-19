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
}