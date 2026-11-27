import {
    IsArray, IsOptional, IsString,
    IsDateString, IsIn, ArrayUnique,
    IsBoolean,
    IsInt,
    Min,
    Max
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetOrdersFilterDto {

    /** IDs de OrderType */
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    orderType?: string[];

    /** IDs de OrderStatus */
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    status?: string[];

    /** IDs de Branch */
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    branch?: string[];

    /** IDs de técnicos */
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    technician?: string[];

    /** IDs de cajeros / receptores */
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    receptionist?: string[];

    // ── Período de ingreso ───────────────────────────────────

    @IsOptional()
    @IsIn(['preset', 'custom'])
    periodMode?: 'preset' | 'custom';

    @IsOptional()
    @IsString()
    presetPeriod?: string;

    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;

    // ── Período de finalización ──────────────────────────────

    @IsOptional()
    @IsIn(['preset', 'custom'])
    endPeriodMode?: 'preset' | 'custom';

    @IsOptional()
    @IsString()
    endPresetPeriod?: string;

    @IsOptional()
    @IsDateString()
    endDateFrom?: string;

    @IsOptional()
    @IsDateString()
    endDateTo?: string;

    // ── Período de entrega ───────────────────────────────────

    @IsOptional()
    @IsIn(['preset', 'custom'])
    deliveryPeriodMode?: 'preset' | 'custom';

    @IsOptional()
    @IsString()
    deliveryPresetPeriod?: string;

    @IsOptional()
    @IsDateString()
    deliveryDateFrom?: string;

    @IsOptional()
    @IsDateString()
    deliveryDateTo?: string;

    @IsOptional()
    @IsBoolean()
    onlyWithPayments?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt() @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt() @Min(1) @Max(100)
    limit?: number = 20;

    /** Si es true, cada orden incluye las comisiones calculadas */
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    includeCommissions?: boolean = false;
    /** Si es true, ignora page/limit y devuelve todo (para reportes físicos) */
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    all?: boolean = false;
}