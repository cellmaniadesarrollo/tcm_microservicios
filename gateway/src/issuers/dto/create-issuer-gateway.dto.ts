import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateIssuerGatewayDto {
  @Matches(/^\d{13}$/, { message: 'El RUC debe tener 13 dígitos' })
  @Matches(/001$/, { message: 'El RUC debe terminar en 001' })
  ruc!: string;

  @IsString() @MaxLength(300) legalName!: string;
  @IsOptional() @IsString() @MaxLength(300) tradeName?: string;
  @IsString() @MaxLength(300) headquartersAddress!: string;

  @IsOptional() @Matches(/^\d{3,5}$/, { message: 'Contribuyente especial: 3 a 5 dígitos' })
  specialTaxpayer?: string;

  @IsOptional() @IsBoolean() accountingRequired?: boolean;
  @IsOptional() @IsIn([1, 2]) environment?: number;
  @IsOptional() @IsIn([1]) emissionType?: number;
}

export class UpdateIssuerGatewayDto {
  @IsOptional() @IsString() @MaxLength(300) legalName?: string;
  @IsOptional() @IsString() @MaxLength(300) tradeName?: string;
  @IsOptional() @IsString() @MaxLength(300) headquartersAddress?: string;
  @IsOptional() @Matches(/^\d{3,5}$/) specialTaxpayer?: string;
  @IsOptional() @IsBoolean() accountingRequired?: boolean;
  @IsOptional() @IsIn([1, 2]) environment?: number;
  @IsOptional() @IsIn([1]) emissionType?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}