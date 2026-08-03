import { PartialType } from '@nestjs/mapped-types';
import { CreateLabelDto } from './create-label.dto';
import { IsString, IsOptional, Matches } from 'class-validator';

export class UpdateLabelDto extends PartialType(CreateLabelDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/)
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  description?: string;
}