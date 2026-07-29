import { IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateBillingDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  identification?: string;

  @IsOptional()
  @IsNumber()
  identificationTypeId?: number;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsString()
  billingPhone?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;
}
