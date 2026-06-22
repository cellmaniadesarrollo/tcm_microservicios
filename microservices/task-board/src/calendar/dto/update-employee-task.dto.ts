// src/calendar/dto/update-employee-task.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeTaskDto } from './create-employee-task.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEmployeeTaskDto extends PartialType(CreateEmployeeTaskDto) {
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;
}