import { IsNumber, IsOptional, IsString } from 'class-validator';

export class DeviceResponseDto {
  @IsNumber()
  device_id!: number;

  @IsNumber()
  models_id!: number;

  @IsNumber()
  device_type_id!: number;

  @IsOptional()
  @IsString()
  serial_number?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  storage?: string;

  imeis?: {
    imei_id: number;
    imei_number: string;
  }[];

  accounts?: {
    account_id: number;
    username: string;
    account_type: string;
  }[];
}