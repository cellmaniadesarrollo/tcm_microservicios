// src/calendar/dto/complete-task.dto.ts
import { IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class CompleteTaskDto {
  @IsUUID()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  completionNotes?: string;

  @IsUrl()
  @IsOptional()
  completionPhotoUrl?: string;
}