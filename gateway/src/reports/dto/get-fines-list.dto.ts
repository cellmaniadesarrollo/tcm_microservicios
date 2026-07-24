// gateway/fines/dto/get-fines-list.dto.ts
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FineStatus } from './fine-status.enum';

export class GetFinesListDto {
    @IsIn(['preset', 'custom'])
    periodMode!: 'preset' | 'custom';

    @IsOptional()
    @IsString()
    presetPeriod?: string;

    @IsOptional()
    @IsString()
    dateFrom?: string;

    @IsOptional()
    @IsString()
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