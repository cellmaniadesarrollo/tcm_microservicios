// gateway/src/orders/dto/create-standalone-travel-item-gateway.dto.ts
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const trim = ({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: any }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value;

export class CreateStandaloneTravelItemGatewayDto {
    @Transform(trim)
    @IsString({ message: 'La descripción debe ser texto' })
    @IsNotEmpty({ message: 'La descripción es obligatoria' })
    @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
    @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres' })
    descripcion!: string;

    @IsString({ message: 'El modo debe ser una cadena de texto' })
    @IsIn(['BUY_CASH', 'PICKUP_PAID'], { message: 'El modo debe ser BUY_CASH o PICKUP_PAID' })
    @IsNotEmpty({ message: 'El modo es obligatorio' })
    mode!: 'BUY_CASH' | 'PICKUP_PAID';

    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString() @MaxLength(100)
    marca?: string;

    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString() @MaxLength(100)
    modelo?: string;

    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString() @MaxLength(100)
    modeloTecnico?: string;

    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString() @MaxLength(100)
    tipo?: string;

    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString() @MaxLength(100)
    color?: string;

    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString() @MaxLength(100)
    calidad?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La cantidad esperada debe ser un número entero' })
    @Min(1, { message: 'La cantidad esperada debe ser mayor a 0' })
    expectedQuantity?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El ID del proveedor sugerido debe ser un número entero' })
    @Min(1, { message: 'El ID del proveedor sugerido debe ser mayor a 0' })
    suggestedProviderId?: number;

    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString({ message: 'Las notas deben ser una cadena de texto' })
    officeNotes?: string;
}