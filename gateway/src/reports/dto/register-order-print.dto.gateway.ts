// gateway/reports/dto/register-order-print.dto.gateway.ts
import { IsInt, IsOptional, IsString, IsUUID, IsBoolean, ValidateIf, IsEnum } from 'class-validator';

export enum PrintableType {
    ORDER_TICKET = 'ORDER_TICKET',
    PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
}

export class RegisterOrderPrintDto {
    @IsEnum(PrintableType)
    entity_type!: PrintableType;

    @IsInt()
    orderId!: number;

    // Requerido solo cuando entity_type === PAYMENT_RECEIPT
    @ValidateIf((o) => o.entity_type === PrintableType.PAYMENT_RECEIPT)
    @IsInt()
    paymentId?: number;

    // Si la impresión fue solicitada por otra persona distinta a quien la ejecuta
    @IsOptional()
    @IsUUID()
    requestedByUserId?: string;

    // Excepción: reimprimir como "original" cuando la primera falló
    @IsOptional()
    @IsBoolean()
    forceAsOriginal?: boolean;

    @ValidateIf((o) => o.forceAsOriginal === true)
    @IsString()
    reprintReason?: string;

    @ValidateIf((o) => o.forceAsOriginal === true)
    @IsUUID()
    authorizedByUserId?: string;
}