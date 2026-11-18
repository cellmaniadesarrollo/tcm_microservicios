import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class SearchSaleProductsQueryDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'La búsqueda no es válida' })
    @MinLength(1, { message: 'Escribe qué buscar' })
    @MaxLength(100, { message: 'La búsqueda no puede superar 100 caracteres' })
    q!: string;

    /** SCANNER = viene del lector (QR); MANUAL = escrito o pegado en el input. */
    @IsOptional()
    @IsIn(['SCANNER', 'MANUAL'], { message: 'El origen de la búsqueda no es válido' })
    source?: 'SCANNER' | 'MANUAL';

    /** Número del lote que trae el QR (solo con source=SCANNER). */
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El lote no es válido' })
    @Min(1, { message: 'El lote no es válido' })
    lotCode?: number;
}