import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateBillingDto {
  @IsNumber()
  @IsNotEmpty()
  customerId: number;

  @IsNumber()
  @IsNotEmpty()
  idTypeId: number;                    // ← cambiado de identificationTypeId

  @IsString()
  @IsNotEmpty()
  idNumber: string;                    // ← cambiado de identification

  @IsNumber()
  @IsNotEmpty()
  personTypeId: number;                // ← NUEVO (natural / juridica)

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsOptional()
  @IsString()
  tradeName?: string;                  // ← NUEVO

  @IsOptional()
  @IsString()
  firstName?: string;                  // ← NUEVO

  @IsOptional()
  @IsString()
  lastName?: string;                   // ← NUEVO

  @IsOptional()
  @IsNumber()
  genderId?: number;                   // ← NUEVO (usa el catálogo de Gender)

  @IsOptional()
  @IsString()
  birthdate?: string;                  // ← NUEVO (formato YYYY-MM-DD)

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  mainEmail: string;                   // ← cambiado de billingEmail

  @IsOptional()
  @IsString()
  cellphone?: string;                  // ← NUEVO

  @IsOptional()
  @IsString()
  phone?: string;                      // ← NUEVO

  @IsString()
  @IsNotEmpty()
  address: string;                     // ← cambiado de billingAddress

  @IsOptional()
  @IsString()
  city?: string;                       // ← NUEVO

  @IsOptional()
  @IsBoolean()
  isCompanyClient?: boolean;
}