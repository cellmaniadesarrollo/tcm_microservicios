import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsArray, 
  IsUUID,
  IsObject,
  MaxLength,
  MinLength
} from 'class-validator';
import { BoardVisibility } from '../entities/board.entity';

export class CreateBoardDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(BoardVisibility)
  @IsOptional()
  visibility?: BoardVisibility;

  @IsUUID()
  ownerId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  members?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  admins?: string[];

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsObject()
  @IsOptional()
  settings?: {
    allowComments?: boolean;
    allowAttachments?: boolean;
    defaultTaskView?: 'list' | 'board' | 'calendar';
    colorScheme?: string;
  };
}