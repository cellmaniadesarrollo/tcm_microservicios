import { Transform } from 'class-transformer';
import {
  IsBoolean, IsInt, IsNotEmpty, IsNumberString, IsOptional,
  IsString, IsUUID, MaxLength,
} from 'class-validator';

export class CreateServiceTypeGatewayDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}

export class UpdateServiceTypeGatewayDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}

export class CreateServiceGatewayDto {
  @IsUUID() serviceTypeId!: string;

  // code lo genera el microservicio de billing; no se envía desde el frontend
  // @IsString() @IsNotEmpty() @MaxLength(40) code!: string;

  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsNumberString() subtotal!: string;
  @IsOptional() @IsBoolean() billable?: boolean;
  @IsOptional() @IsInt() vatRateId?: number;
}

export class UpdateServiceGatewayDto {
  @IsOptional() @IsUUID() serviceTypeId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsNumberString() subtotal?: string;
  @IsOptional() @IsBoolean() billable?: boolean;
  @IsOptional() @IsInt() vatRateId?: number;
}

export class SetActiveGatewayDto {
  @IsBoolean() isActive!: boolean;
}

const toBool = ({ value }: { value: any }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined;

export class ListServicesQueryDto {
  @IsOptional() @IsUUID() serviceTypeId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Transform(toBool) @IsBoolean() onlyActive?: boolean;
}

export class ListServiceTypesQueryDto {
  @IsOptional() @Transform(toBool) @IsBoolean() onlyActive?: boolean;
}