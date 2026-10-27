import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchSuppliersQueryDto {
    /** Palabras separadas por espacio, en cualquier orden. Vacío = primeros resultados. */
    @IsOptional() @IsString() @MaxLength(100)
    q?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
    limit?: number = 20;

    /** Por defecto solo activos. Útil al editar un registro que ya tiene un proveedor inactivo. */
    @IsOptional()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    @IsBoolean()
    includeInactive?: boolean;
}