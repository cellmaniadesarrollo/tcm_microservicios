// gateway/reports/dto/register-print-copy.dto.gateway.ts
import { IsInt, IsOptional, IsString, IsUUID, IsBoolean, ValidateIf, IsEnum, Min, Max } from 'class-validator';
import { PrintableType } from '../schemas/order-print-status.schema';


export class RegisterPrintCopyDto {
    @IsEnum(PrintableType)
    entity_type!: PrintableType;

    @IsInt()
    orderId!: number;

    @ValidateIf((o) => o.entity_type === PrintableType.PAYMENT_RECEIPT)
    @IsInt()
    paymentId?: number;

    // Si la copia fue solicitada por otra persona distinta a quien la ejecuta
    @IsOptional()
    @IsUUID()
    requestedByUserId?: string;

    // Cantidad de copias físicas en este mismo evento (default 1)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10)
    copies?: number;

    // Excepción: reimprimir COMO ORIGINAL cuando el original falló
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