// src/notifications/dto/track-action.dto.ts
import { IsUUID, IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class TrackActionDto {
  @IsUUID()
  @IsNotEmpty()
  notificationId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  action: 'viewed' | 'clicked' | 'opened' | 'dismissed';

  @IsObject()
  @IsOptional()
  actionData?: {
    ipAddress?: string;
    userAgent?: string;
    deviceType?: string;
    timeSpent?: number;
  };
}