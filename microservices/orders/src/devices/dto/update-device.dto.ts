// update-device.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class UpdateImeiDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  imei_id?: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  imei_number!: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  account_id?: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  username!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  account_type!: string;
}

export class UpdateDeviceDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  models_id!: number;

  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  device_type_id!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  storage?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateImeiDto)
  imeis?: UpdateImeiDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAccountDto)
  accounts?: UpdateAccountDto[];
}