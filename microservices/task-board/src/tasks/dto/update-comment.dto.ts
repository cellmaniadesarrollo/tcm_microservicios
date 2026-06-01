// tasks/dto/update-comment.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @MaxLength(2000)
  content: string;
}