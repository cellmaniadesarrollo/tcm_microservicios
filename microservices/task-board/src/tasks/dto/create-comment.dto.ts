// tasks/dto/create-comment.dto.ts
import { IsUUID, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  userId: string;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsUUID()
  @IsOptional()
  parentCommentId?: string;
}
