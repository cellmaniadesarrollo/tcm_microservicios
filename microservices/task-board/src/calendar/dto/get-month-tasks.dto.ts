// src/calendar/dto/get-month-tasks.dto.ts
import { IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMonthTasksDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  month: number;

  @IsUUID()
  @IsOptional()
  userId?: string;  // Cambiado de employeeId a userId
}