import { PrintableType } from '../schemas/order-print-status.schema';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    ValidateIf,
} from 'class-validator';

export class RegisterOrderPrintDto {
    @IsEnum(PrintableType)
    entity_type!: PrintableType;

    @IsInt()
    orderId!: number;

    @ValidateIf((o) => o.entity_type === PrintableType.PAYMENT_RECEIPT)
    @IsInt()
    paymentId?: number;

    @IsOptional()
    @IsUUID()
    requestedByUserId?: string;

    @IsOptional()
    @IsBoolean()
    forceAsOriginal?: boolean;

    @ValidateIf((o) => o.forceAsOriginal)
    @IsString()
    reprintReason?: string;

    @ValidateIf((o) => o.forceAsOriginal)
    @IsUUID()
    authorizedByUserId?: string;
}