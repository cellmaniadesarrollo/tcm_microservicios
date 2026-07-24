// gateway/fines/dto/get-employees-fines.dto.ts
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FineStatus } from './fine-status.enum';

export class GetEmployeesFinesDto {
    @IsDateString()
    startDate!: string;

    @IsDateString()
    endDate!: string;

    @IsOptional()
    @IsEnum(FineStatus)
    status?: FineStatus;

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