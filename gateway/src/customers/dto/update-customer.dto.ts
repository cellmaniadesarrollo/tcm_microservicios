import { 
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateContactDto {

  @IsOptional()
  @IsNumber()
  id?: number;     // 👈 NECESARIO para editar

  @IsOptional()
  @IsNumber()
  contactTypeId?: number;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

class UpdateAddressDto {

  @IsOptional()
  @IsNumber()
  id?: number;     // 👈 NECESARIO para editar

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

export class UpdateCustomerDto {
  // ❌ NO SE PERMITEN EDITAR:
  // idNumber
  // idTypeId

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsNumber()
  genderId?: number;
 

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateContactDto)
  contacts?: UpdateContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAddressDto)
  addresses?: UpdateAddressDto[];
}
