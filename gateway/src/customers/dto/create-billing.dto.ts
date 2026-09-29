import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';
import { IsValidIdNumber } from '../../common/validators/is-valid-id-number.decorator';

export class CreateBillingDto {
  // ❌ customerId ya no aplica: ahora se resuelve/crea por idNumber+companyId,
  // igual que el legacy (upsertCustomerAndBillingData).

  @IsNumber()
  @IsNotEmpty()
  idTypeId: number;

  @IsString()
  @IsNotEmpty()
  @IsValidIdNumber()
  idNumber: string;

  @IsNumber()
  @IsNotEmpty()
  personTypeId: number;                // natural / jurídica

  @IsOptional()
  @IsString()
  businessName?: string;               // ← ahora opcional: solo fallback para first/lastName si es jurídica

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsNumber()
  genderId?: number;

  @IsOptional()
  @IsString()
  birthdate?: string;                  // 'YYYY-MM-DD'

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  mainEmail: string;

  @IsOptional()
  @IsString()
  cellphone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  cityId?: number;


  @IsOptional()
  @IsBoolean()
  isCompanyClient?: boolean;
}