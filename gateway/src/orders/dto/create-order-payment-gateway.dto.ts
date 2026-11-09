import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

// ID de "TRANSFERENCIA" en la tabla de métodos de pago
export const PAYMENT_METHOD_TRANSFERENCIA_ID = 4;

export class CreateOrderPaymentGatewayDto {
  @IsInt()
  @Min(1)
  orderId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El monto debe ser mayor que cero' })
  amount!: number;

  @IsInt()
  @Min(1)
  paymentTypeId!: number;

  @IsOptional()
  @IsInt()
  paymentMethodId?: number | null = null;

  // Obligatoria si es TRANSFERENCIA; en los demás casos es opcional,
  // pero si viene debe ser texto.
  @ValidateIf(
    (o) =>
      o.paymentMethodId === PAYMENT_METHOD_TRANSFERENCIA_ID ||
      (o.reference !== undefined && o.reference !== null),
  )
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La referencia debe ser texto' })
  @IsNotEmpty({
    message: 'El número de transferencia es obligatorio para pagos por transferencia',
  })
  reference?: string;

  @IsOptional()
  @IsString()
  observation?: string;
}