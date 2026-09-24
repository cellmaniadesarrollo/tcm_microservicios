// gateway/src/orders/order-discounts/dto/cancelar-descuento-orden-gateway.dto.ts
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CancelarDescuentoOrdenGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID de la orden debe ser un número entero' })
    @Min(1, { message: 'El ID de la orden debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID de la orden es obligatorio' })
    orderId!: number;

    @Type(() => Number)
    @IsInt({ message: 'El ID del descuento debe ser un número entero' })
    @Min(1, { message: 'El ID del descuento debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID del descuento es obligatorio' })
    discountId!: number;

    @IsOptional()
    @IsString({ message: 'El motivo de cancelación debe ser una cadena de texto' })
    cancelledReason?: string;
}