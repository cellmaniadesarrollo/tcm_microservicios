// gateway/src/orders/order-discounts/dto/crear-descuento-orden-gateway.dto.ts
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum DiscountTypeGatewayEnum {
    FIXED = 'FIXED',
    PERCENTAGE = 'PERCENTAGE',
}
export enum DiscountStatusGatewayEnum {
    PENDING = 'PENDING',
    APPLIED = 'APPLIED',
    CANCELLED = 'CANCELLED',
}
export class CrearDescuentoOrdenGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID de la orden debe ser un número entero' })
    @Min(1, { message: 'El ID de la orden debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID de la orden es obligatorio' })
    orderId!: number;

    @IsEnum(DiscountTypeGatewayEnum, { message: 'El tipo de descuento debe ser FIXED o PERCENTAGE' })
    @IsNotEmpty({ message: 'El tipo de descuento es obligatorio' })
    discountType!: DiscountTypeGatewayEnum;

    @Type(() => Number)
    @IsNumber({}, { message: 'El valor del descuento debe ser un número' })
    @IsPositive({ message: 'El valor del descuento debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El valor del descuento es obligatorio' })
    discountValue!: number;

    @IsOptional()
    @IsString({ message: 'El motivo debe ser una cadena de texto' })
    reason?: string;
}