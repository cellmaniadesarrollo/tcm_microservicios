// gateway/reports/dto/get-print-status.dto.gateway.ts
import { IsInt, IsOptional, IsEnum } from 'class-validator';
import { Type as TransformType } from 'class-transformer';
import { PrintableType } from './register-order-print.dto.gateway';

export class GetPrintStatusDto {
    @IsEnum(PrintableType)
    entity_type!: PrintableType;

    @TransformType(() => Number)
    @IsInt()
    orderId!: number;

    @IsOptional()
    @TransformType(() => Number)
    @IsInt()
    paymentId?: number;
}