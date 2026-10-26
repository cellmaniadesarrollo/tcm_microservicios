import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested
} from 'class-validator';

class CreateContactDto {
  @IsNumber()
  contactTypeId!: number;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  isPrimary?: boolean = false;
}

class CreateAddressDto {
  @IsOptional()
  @IsNumber()
  cityId?: number;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  mainStreet?: string;

  @IsOptional()
  @IsString()
  secondaryStreet?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class CreateCustomerDto {
  @IsNumber()
  idTypeId!: number;

  @IsString()
  idNumber!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsNumber()
  genderId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  contacts!: CreateContactDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddressDto)
  addresses!: CreateAddressDto[];

  // 🔐 PIN de quien firma (solo si la cuenta lo exige).
  // El controller lo separa del cliente antes de reenviarlo al MS.
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener 6 dígitos' })
  pin?: string;
}