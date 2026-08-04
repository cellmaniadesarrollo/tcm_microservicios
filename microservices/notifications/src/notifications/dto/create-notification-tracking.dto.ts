// src/notifications/dto/create-notification-tracking.dto.ts
import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';

export class CreateNotificationTrackingDto {
  @IsUUID()
  notificationId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isCalled?: boolean;

  @IsOptional()
  @IsBoolean()
  hasProblems?: boolean;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  calledBy?: string;

  @IsOptional()
  @IsString()
  calledByName?: string;

  @IsOptional()
  @IsString()
  problemReportedBy?: string;

  @IsOptional()
  @IsString()
  problemReportedByName?: string;

  @IsOptional()
  @IsString()
  archivedBy?: string;

  @IsOptional()
  @IsString()
  archivedByName?: string;
}