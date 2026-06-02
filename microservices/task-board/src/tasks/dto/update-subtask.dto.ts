// tasks/dto/update-subtask.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSubTaskDto } from './create-subtask.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { SubTaskStatus } from '../entities/subtask.entity';

export class UpdateSubTaskDto extends PartialType(CreateSubTaskDto) {
  @IsEnum(SubTaskStatus)
  @IsOptional()
  status?: SubTaskStatus;
}