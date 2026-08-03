// tasks/dto/create-subtask.dto.ts
import { IsUUID, IsString, IsOptional, IsEnum, IsDateString, IsNumber, Min, MaxLength } from 'class-validator';
import { SubTaskStatus } from '../entities/subtask.entity';

export class CreateSubTaskDto {
  @IsUUID()
  parentTaskId: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(SubTaskStatus)
  @IsOptional()
  status?: SubTaskStatus;

  @IsUUID()
  @IsOptional()
  assignedTo?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: Date;

  @IsNumber()
  @Min(0)
  @IsOptional()
  order?: number;
}