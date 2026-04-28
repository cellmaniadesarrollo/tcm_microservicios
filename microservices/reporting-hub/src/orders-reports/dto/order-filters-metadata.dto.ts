import {
    IsArray, IsOptional, IsString,
    IsDateString, IsIn, ArrayUnique
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GetOrdersFilterDto {

    /** IDs de OrderType (ej: ["1","2"]) */
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value])) // <--- TRUCO AQUÍ
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
}