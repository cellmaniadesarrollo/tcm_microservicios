import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateReceiptPaymentGatewayDto {
    /** UUID generado por el front al abrir el formulario de pago. Evita registrar el pago dos veces. */
    @IsUUID('4', { message: 'El identificador de solicitud no es válido' })
    clientRequestId!: string;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico (hasta 2 decimales)' })
    @Min(0.01, { message: 'El monto debe ser mayor a 0' }) @Max(9999999999.99)
    amount!: number;

    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato AAAA-MM-DD' })
    paidAt!: string;

    @IsIn(['CASH', 'TRANSFER', 'CHECK', 'CARD', 'OTHER'], { message: 'El método de pago no es válido' })
    method!: 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER';

    @IsOptional() @IsString() @MaxLength(100)
    reference?: string;

    @IsOptional() @IsString() @MaxLength(500)
    note?: string;
}