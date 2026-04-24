// src/notifications/dto/update-notification.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationDto } from './create-notification.dto';
import { IsBoolean, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  readAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  viewedAt?: Date;

  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;
}