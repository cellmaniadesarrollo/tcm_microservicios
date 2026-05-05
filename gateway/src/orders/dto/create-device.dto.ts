import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class IMEIItem {
  @IsString()
  imei_number!: string;
}

class AccountItem {
  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsString()
  account_type!: string;
}

export class CreateDeviceDto {
  @IsOptional()
  @IsString()
  serial_number?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  storage?: string;

  @IsOptional()
  @IsString()
  observations?: string;       // ✅ NUEVO

  @IsNumber()
  models_id!: number;

  @IsNumber()
  device_type_id!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IMEIItem)
  imeis?: IMEIItem[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountItem)
  accounts?: AccountItem[];
}