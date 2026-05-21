import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsUUID, 
  IsArray,
  IsDateString,
  IsNumber,
  Min,
  MaxLength
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsUUID()
  boardId: string;

  @IsUUID()
  @IsOptional()
  assignedTo?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  collaborators?: string[];

  @IsUUID()
  createdBy: string;

  @IsDateString()
  @IsOptional()
  dueDate?: Date;

  @IsDateString()
  @IsOptional()
  startDate?: Date;

  @IsNumber()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedHours?: number;

  @IsUUID()
  @IsOptional()
  parentTaskId?: string;
}