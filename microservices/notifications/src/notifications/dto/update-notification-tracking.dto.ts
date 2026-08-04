// src/notifications/dto/update-notification-tracking.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationTrackingDto } from './create-notification-tracking.dto';
import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateNotificationTrackingDto extends PartialType(CreateNotificationTrackingDto) {
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsString()
  archivedBy?: string;

  @IsOptional()
  @IsString()
  archivedByName?: string;

  @IsOptional()
  @IsString()
  problemReportedBy?: string;

  @IsOptional()
  @IsString()
  problemReportedByName?: string;

  @IsOptional()
  @IsString()
  unarchivedBy?: string;

  @IsOptional()
  @IsString()
  unarchivedByName?: string;
}