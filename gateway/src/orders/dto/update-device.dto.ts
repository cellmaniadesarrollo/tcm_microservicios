import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateDeviceImeiGatewayDto {
  @IsOptional()
  @IsNumber()
  imei_id?: number;

  @IsString()
  imei_number!: string;        // ✅ !
}

class UpdateDeviceAccountGatewayDto {
  @IsOptional()
  @IsNumber()
  account_id?: number;

  @IsString()
  username!: string;           // ✅ !

  @IsOptional()
  @IsString()
  password?: string;

  @IsString()
  account_type!: string;       // ✅ !
}

export class UpdateDeviceGatewayDto {
  @IsNumber()
  deviceId!: number;           // ✅ !

  @IsNumber()
  models_id!: number;          // ✅ !

  @IsNumber()
  device_type_id!: number;     // ✅ !

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  storage?: string;



  @IsOptional()
  @IsString()
  observations?: string;       // ✅ NUEVO

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDeviceImeiGatewayDto)
  imeis?: UpdateDeviceImeiGatewayDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDeviceAccountGatewayDto)
  accounts?: UpdateDeviceAccountGatewayDto[];
}