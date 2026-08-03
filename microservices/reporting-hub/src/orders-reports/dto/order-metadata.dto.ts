import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetOrdersFilterDto {

    // ── Paginación ────────────────────────────────────────────────────────────
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    // ── Filtros por IDs ───────────────────────────────────────────────────────
    @IsOptional()
    @IsArray()
    @Type(() => Number)
    status?: number[];

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    orderType?: number[];

    @IsOptional()
    @IsArray()
    branch?: string[];

    @IsOptional()
    @IsArray()
    technician?: string[];

    @IsOptional()
    @IsArray()
    receptionist?: string[];

    // ── Período de ingreso — modo preset/rango manual (flujo original) ─────────
    @IsOptional()
    @IsString()
    periodMode?: string;          // 'preset' | 'range'

    @IsOptional()
    @IsString()
    presetPeriod?: string;        // 'today' | 'week' | 'month' | etc.

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    dateFrom?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    dateTo?: Date;

    // ── Período de ingreso — fechas directas (para drill-down del dashboard) ───
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    entryFrom?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    entryTo?: Date;

    // ── Período de finalización (status id=7) ─────────────────────────────────
    @IsOptional()
    @IsString()
    endPeriodMode?: string;

    @IsOptional()
    @IsString()
    endPresetPeriod?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDateFrom?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDateTo?: Date;

    // ── Período de entrega (status id=8) ──────────────────────────────────────
    @IsOptional()
    @IsString()
    deliveryPeriodMode?: string;

    @IsOptional()
    @IsString()
    deliveryPresetPeriod?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    deliveryDateFrom?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    deliveryDateTo?: Date;

    // ── Flag exclusivo del drill-down ─────────────────────────────────────────
    @IsOptional()
    @IsBoolean()
    onlyWithPayments?: boolean;
}