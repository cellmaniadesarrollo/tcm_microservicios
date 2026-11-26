import {
  IsBoolean, IsInt, IsNotEmpty, IsNumberString, IsOptional,
  IsString, IsUUID, MaxLength,
} from 'class-validator';

export class CreateServiceTypeDto {
  @IsUUID() companyId: string;
  @IsUUID() createdBy: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}

export class UpdateServiceTypeDto {
  @IsUUID() companyId: string;
  @IsUUID() id: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}

export class CreateServiceDto {
  @IsUUID() companyId: string;
  @IsUUID() createdBy: string;
  @IsUUID() serviceTypeId: string;
  @IsString() @IsNotEmpty() @MaxLength(40) code: string;
  @IsString() @IsNotEmpty() @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsNumberString({ no_symbols: false }) subtotal: string;
  @IsOptional() @IsInt() vatRateId?: number;
}

export class UpdateServiceDto {
  @IsUUID() companyId: string;
  @IsUUID() id: string;
  @IsUUID() updatedBy: string;
  @IsOptional() @IsUUID() serviceTypeId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsNumberString({ no_symbols: false }) subtotal?: string;
  @IsOptional() @IsInt() vatRateId?: number;
}

export class SetActiveDto {
  @IsUUID() companyId: string;
  @IsUUID() id: string;
  @IsUUID() updatedBy: string;
  @IsBoolean() isActive: boolean;
}

export class ListServicesDto {
  @IsUUID() companyId: string;
  @IsOptional() @IsUUID() serviceTypeId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsBoolean() onlyActive?: boolean;
}