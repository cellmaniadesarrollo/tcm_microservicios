import {
    IsArray, IsOptional, IsString,
    IsDateString, IsIn, ArrayUnique
} from 'class-validator';

export class GetOrdersFilterDto {

    /** IDs de OrderType  (ej: ["1","2"]) */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    orderType?: string[];

    /** IDs de OrderStatus */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    status?: string[];

    /** IDs de Branch */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    branch?: string[];

    /** IDs de técnicos (UserSnapshot.id) */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    technician?: string[];

    /** IDs de cajeros / receptores */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    receptionist?: string[];

    /** Modo de período: preset o custom */
    @IsOptional()
    @IsIn(['preset', 'custom'])
    periodMode?: 'preset' | 'custom';

    /** Mes preset en formato "YYYY-MM" */
    @IsOptional()
    @IsString()
    presetPeriod?: string; // ej: "2026-04"

    /** Inicio rango personalizado */
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    /** Fin rango personalizado */
    @IsOptional()
    @IsDateString()
    dateTo?: string;
}