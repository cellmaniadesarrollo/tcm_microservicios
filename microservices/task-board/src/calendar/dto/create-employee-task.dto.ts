// src/calendar/dto/create-employee-task.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';

export class CreateEmployeeTaskDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;  // Cambiado de employeeId a userId

  @IsNotEmpty()
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;

  @IsOptional()
  @IsString()
  dueTime?: string;

  @IsEnum(['alta', 'media', 'baja'])
  @IsOptional()
  priority?: string;

  @IsUUID()
  @IsOptional()
  relatedBoardId?: string;

  @IsUUID()
  @IsOptional()
  relatedTaskId?: string;
}