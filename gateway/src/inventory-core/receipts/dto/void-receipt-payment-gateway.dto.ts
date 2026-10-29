import { IsString, MaxLength, MinLength } from 'class-validator';

export class VoidReceiptPaymentGatewayDto {
    @IsString() @MinLength(3, { message: 'Indica el motivo' }) @MaxLength(500)
    reason!: string;
}