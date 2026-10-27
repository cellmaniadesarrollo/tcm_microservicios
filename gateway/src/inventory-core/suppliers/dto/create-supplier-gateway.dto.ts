import { Transform } from 'class-transformer';
import {
    IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { IdentificationType } from '../enums/supplier.enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** "" -> undefined, para que los opcionales vacíos no lleguen como string vacío. */
const trimOrUndefined = ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    return v === '' ? undefined : v;
};

export class CreateSupplierGatewayDto {
    @IsEnum(IdentificationType, { message: 'El tipo de identificación no es válido' })
    identificationType!: IdentificationType;

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'El número de identificación es obligatorio' })
    @MaxLength(50)
    identificationNumber!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'La razón social es obligatoria' })
    @MaxLength(200)
    businessName!: string;

    @IsOptional()
    @Transform(trimOrUndefined)
    @IsString()
    @MaxLength(200)
    tradeName?: string;

    @IsUUID('4', { message: 'El país no es válido' })
    countryId!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'La dirección es obligatoria' })
    @MaxLength(255)
    address!: string;

    @IsOptional()
    @Transform(trimOrUndefined)
    @IsString()
    @MaxLength(30)
    phone?: string;

    @IsOptional()
    @Transform(trimOrUndefined)
    @IsEmail({}, { message: 'El correo no es válido' })
    @MaxLength(150)
    email?: string;
}