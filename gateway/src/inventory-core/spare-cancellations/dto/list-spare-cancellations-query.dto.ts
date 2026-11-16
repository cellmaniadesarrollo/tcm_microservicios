import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListSpareCancellationsQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La página debe ser un número entero' })
    @Min(1, { message: 'La página debe ser mayor o igual a 1' })
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El límite debe ser un número entero' })
    @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
    @Max(100, { message: 'El límite máximo es 100' })
    limit?: number;

    @IsOptional()
    @IsIn(['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'], { message: 'El estado de la solicitud no es válido' })
    status?: 'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED';

    @IsOptional()
    @IsString({ message: 'La búsqueda debe ser texto' })
    @MaxLength(100, { message: 'La búsqueda es demasiado larga' })
    search?: string;

    @IsOptional()
    @IsIn(['createdAt', 'orderNumber', 'productName', 'sku'], { message: 'El orden no es válido' })
    sortBy?: 'createdAt' | 'orderNumber' | 'productName' | 'sku';

    @IsOptional()
    @IsIn(['ASC', 'DESC'], { message: 'La dirección del orden no es válida' })
    sortDir?: 'ASC' | 'DESC';

    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean({ message: 'includeFilters debe ser verdadero o falso' })
    includeFilters?: boolean;
}