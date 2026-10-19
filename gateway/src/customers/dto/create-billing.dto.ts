import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';
import { IsValidIdNumber } from '../../common/validators/is-valid-id-number.decorator';

export class CreateBillingDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  idTypeId: number;

  @IsString()
  @IsNotEmpty()
  @IsValidIdNumber()
  idNumber: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  personTypeId: number;

  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() tradeName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  genderId?: number;

  @IsOptional() @IsString() birthdate?: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  mainEmail: string;

  @IsOptional() @IsString() cellphone?: string;
  @IsOptional() @IsString() phone?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional() @IsString() city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;

  @IsOptional() @IsBoolean() isCompanyClient?: boolean;
}