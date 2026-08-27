import { IsEmail, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateBillingDto {
  @IsOptional()
  @IsNumber()
  idTypeId?: number;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsEmail()
  mainEmail?: string;

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
  @IsBoolean()
  isActive?: boolean;
}