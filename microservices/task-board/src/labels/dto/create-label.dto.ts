import { IsString, IsUUID, IsOptional, Matches, MaxLength } from 'class-validator';

export class CreateLabelDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g., #FF5733)' })
  color: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  boardId: string;
}