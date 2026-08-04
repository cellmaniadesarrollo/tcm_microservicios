// fines/dto/get-fines-list.dto.ts
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FineStatus } from '../schemas/fine.schema';

export class GetFinesListDto {
    @IsIn(['preset', 'custom'])
    periodMode!: 'preset' | 'custom';

    // Formato 'YYYY-MM', ej. '2026-07'
    @IsOptional()
    @IsString()
    presetPeriod?: string;

    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;

    @IsOptional()
    @IsEnum(FineStatus)
    status?: FineStatus;

    @IsOptional()
    @IsString()
    employeeId?: string;

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
}