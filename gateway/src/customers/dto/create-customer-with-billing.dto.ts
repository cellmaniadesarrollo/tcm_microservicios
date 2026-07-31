// dto/create-customer-with-billing.dto.ts
import { Type } from 'class-transformer';
import {
    IsArray, IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsNumber,
    IsOptional, IsString, ValidateNested,
} from 'class-validator';

class CreateContactDto {
    @IsNumber() contactTypeId: number;
    @IsString() @IsNotEmpty() value: string;
    @IsOptional() isPrimary?: boolean = false;
}

class CreateAddressDto {
    @IsOptional() @IsNumber() cityId?: number;
    @IsOptional() @IsString() zone?: string;
    @IsOptional() @IsString() sector?: string;
    @IsOptional() @IsString() locality?: string;
    @IsOptional() @IsString() mainStreet?: string;
    @IsOptional() @IsString() secondaryStreet?: string;
    @IsOptional() @IsString() reference?: string;
    @IsOptional() @IsString() postalCode?: string;
}

class CustomerBlockDto {
    @IsNumber() idTypeId: number;
    @IsString() @IsNotEmpty() idNumber: string;
    @IsString() @IsNotEmpty() firstName: string;
    @IsString() @IsNotEmpty() lastName: string;
    @IsOptional() @IsDateString() birthDate?: string;
    @IsOptional() @IsNumber() genderId?: number;

    @IsArray() @ValidateNested({ each: true }) @Type(() => CreateContactDto)
    contacts: CreateContactDto[];

    @IsArray() @ValidateNested({ each: true }) @Type(() => CreateAddressDto)
    addresses: CreateAddressDto[];
}

// Solo lo que NO se puede derivar del customer
class BillingExtraBlockDto {
    @IsNumber() @IsNotEmpty() personTypeId: number;

    @IsOptional() @IsString() businessName?: string; // si no viene, se autogenera de firstName+lastName
    @IsOptional() @IsString() tradeName?: string;
    @IsOptional() @IsBoolean() isCompanyClient?: boolean;

    // Overrides opcionales por si el usuario quiere que la facturación
    // NO use exactamente los mismos contactos/dirección del customer
    @IsOptional() @IsEmail() mainEmailOverride?: string;
    @IsOptional() @IsString() addressOverride?: string;
    @IsOptional() @IsString() cityOverride?: string;
}

export class CreateCustomerWithBillingDto {
    @ValidateNested() @Type(() => CustomerBlockDto)
    customer: CustomerBlockDto;

    @IsOptional()
    @ValidateNested() @Type(() => BillingExtraBlockDto)
    billing?: BillingExtraBlockDto;
}