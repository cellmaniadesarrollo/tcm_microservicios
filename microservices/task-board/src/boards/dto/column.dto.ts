// boards/dto/column.dto.ts
import { IsString, IsOptional, IsNumber, IsArray, Min, Max, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateColumnDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsNumber()
  @Min(0)
  order: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  wipLimit?: number;
}

export class UpdateColumnDto extends PartialType(CreateColumnDto) {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  tasks?: string[];
}

export class MoveTaskDto {
  @IsUUID()
  taskId: string;

  @IsString()
  fromColumnId: string;

  @IsString()
  toColumnId: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  newOrder?: number;
}