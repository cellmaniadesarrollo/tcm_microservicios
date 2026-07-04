import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { IsEnum, IsOptional, IsUUID, IsNumber, Min, IsString } from 'class-validator';
import { TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsUUID()
  @IsOptional()
  updatedBy?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualHours?: number;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsUUID()
  @IsOptional()
  columnId?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsNumber()
  @IsOptional()
  orderId?: string | null;
}