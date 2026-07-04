// tasks/dto/create-task.dto.ts
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
  columnId?: string;  // ✅ NUEVO

  @IsUUID()
  @IsOptional()
  assignedTo?: string;

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
  @IsOptional()
  orderId?: string | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedHours?: number;

  @IsUUID()
  @IsOptional()
  parentTaskId?: string;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  columnName?: string;
}