// gateway/src/orders/order-discounts/dto/listar-descuentos-orden-gateway.dto.ts
import { IsEnum, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountStatusGatewayEnum } from './crear-descuento-orden-gateway.dto';

export class ListarDescuentosOrdenGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID de la orden debe ser un número entero' })
    @Min(1, { message: 'El ID de la orden debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID de la orden es obligatorio' })
    orderId!: number;

    @IsOptional()
    @IsEnum(DiscountStatusGatewayEnum, { message: 'El estado debe ser PENDING, APPLIED o CANCELLED' })
    status?: DiscountStatusGatewayEnum;
}