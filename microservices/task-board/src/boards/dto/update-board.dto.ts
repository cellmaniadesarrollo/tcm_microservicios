import { PartialType } from '@nestjs/mapped-types';
import { CreateBoardDto } from './create-board.dto';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BoardStatus } from '../entities/board.entity';

export class UpdateBoardDto extends PartialType(CreateBoardDto) {
  @IsEnum(BoardStatus)
  @IsOptional()
  status?: BoardStatus;

  @IsUUID()
  @IsOptional()
  updatedBy?: string;
}