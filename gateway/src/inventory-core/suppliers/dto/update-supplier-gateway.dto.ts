import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** "" -> null: en la edición un opcional vacío significa "borrar el valor". */
const trimOrNull = ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    return v === '' ? null : v;
};

/**
 * No incluye identificationType, identificationNumber ni code: son inmutables.
 * Todos los campos son opcionales (PATCH parcial).
 */
export class UpdateSupplierGatewayDto {
    @IsOptional()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'La razón social no puede estar vacía' })
    @MaxLength(200)
    businessName?: string;

    @IsOptional()
    @Transform(trimOrNull)
    @IsString()
    @MaxLength(200)
    tradeName?: string | null;

    @IsOptional()
    @IsUUID('4', { message: 'El país no es válido' })
    countryId?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'La dirección no puede estar vacía' })
    @MaxLength(255)
    address?: string;

    @IsOptional()
    @Transform(trimOrNull)
    @IsString()
    @MaxLength(30)
    phone?: string | null;

    @IsOptional()
    @Transform(trimOrNull)
    @IsEmail({}, { message: 'El correo no es válido' })
    @MaxLength(150)
    email?: string | null;
}