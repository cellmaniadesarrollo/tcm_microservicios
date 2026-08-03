// users/src/google/dto/google-token.dto.ts
import { IsString, IsOptional, IsNumber, IsUUID, IsBoolean } from 'class-validator';

export class SaveGoogleTokenDto {
  @IsString()
  accessToken!: string;

  @IsString()
  refreshToken!: string;

  @IsOptional()
  @IsNumber()
  expiryDate?: number;
}

export class GoogleTokenResponseDto {
  @IsString()
  accessToken!: string;

  @IsString()
  refreshToken!: string;

  @IsOptional()
  expiryDate?: Date;
}

export class GoogleTokenStatusDto {
  @IsUUID()
  employeeId!: string;

  @IsBoolean()
  hasGoogleToken!: boolean;
}