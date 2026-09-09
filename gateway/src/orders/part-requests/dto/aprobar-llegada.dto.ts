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

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio de venta debe ser un número válido' })
    @Min(0, { message: 'El precio de venta no puede ser negativo' })
    precioVenta?: number;
}