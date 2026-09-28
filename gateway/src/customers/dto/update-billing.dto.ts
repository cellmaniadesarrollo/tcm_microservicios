import { IsEmail, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateBillingDto {
  @IsOptional()
  @IsNumber()
  idTypeId?: number;

  @IsOptional()
  @IsNumber()
  personTypeId?: number;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsNumber()
  genderId?: number;

  @IsOptional()
  @IsString()
  birthdate?: string;

  @IsOptional()
  @IsEmail()
  mainEmail?: string;

  @IsOptional()
  @IsString()
  cellphone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  cityId?: number;

  @IsOptional()
  @IsBoolean()
  isCompanyClient?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}