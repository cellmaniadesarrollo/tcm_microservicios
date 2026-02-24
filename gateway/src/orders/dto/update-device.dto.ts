import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateDeviceAccountDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  password?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  account_type?: string;
}

export class UpdateDeviceDto {
  @IsInt()
  @IsOptional()
  models_id?: number;

  @IsInt()
  @IsOptional()
  device_type_id?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  serial_number?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  storage?: string;

  // ---- IMEIs ----
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imeis?: string[];

  // ---- Accounts ----
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDeviceAccountDto)
  @IsOptional()
  accounts?: UpdateDeviceAccountDto[];
}
