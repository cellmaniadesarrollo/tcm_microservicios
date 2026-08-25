import { IsInt, IsNumber, IsNotEmpty, IsOptional, IsString, Min, IsPositive } from 'class-validator';

export class CreateWarehousePaymentGatewayDto {
    @IsNotEmpty({ message: 'El id del pedido es obligatorio.' })
    @IsInt({ message: 'El id del pedido debe ser un número entero.' })
    @Min(1, { message: 'El id del pedido debe ser mayor a 0.' })
    orderId: number;

    @IsNotEmpty({ message: 'El monto es obligatorio.' })
    @IsNumber({}, { message: 'El monto debe ser un número válido.' })
    @IsPositive({ message: 'El monto debe ser un valor positivo.' })
    amount: number;

    @IsNotEmpty({ message: 'El tipo de pago es obligatorio.' })
    @IsInt({ message: 'El id del tipo de pago debe ser un número entero.' })
    @Min(1, { message: 'El id del tipo de pago debe ser mayor a 0.' })
    paymentTypeId: number;

    @IsNotEmpty({ message: 'El método de pago es obligatorio.' })
    @IsInt({ message: 'El id del método de pago debe ser un número entero.' })
    @Min(1, { message: 'El id del método de pago debe ser mayor a 0.' })
    paymentMethodId: number;

    @IsOptional()
    @IsString({ message: 'La referencia debe ser una cadena de texto.' })
    reference?: string;

    @IsOptional()
    @IsString({ message: 'La observación debe ser una cadena de texto.' })
    observation?: string;
}