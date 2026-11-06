import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class ListStockVouchersQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @IsOptional()
    @IsIn(['createdAt', 'code'])
    sortBy?: 'createdAt' | 'code';

    @IsOptional()
    @IsIn(['ASC', 'DESC', 'asc', 'desc'])
    sortDir?: 'ASC' | 'DESC' | 'asc' | 'desc';

    @IsOptional()
    @IsIn(['OUT', 'IN'], { message: 'La dirección debe ser OUT o IN' })
    direction?: 'OUT' | 'IN';

    @IsOptional()
    @IsUUID('4', { message: 'El motivo no es válido' })
    reasonId?: string;

    @IsOptional()
    @IsUUID('4', { message: 'El empleado no es válido' })
    employeeId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La orden no es válida' })
    @Min(1)
    orderId?: number;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha "desde" debe tener formato AAAA-MM-DD' })
    from?: string;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha "hasta" debe tener formato AAAA-MM-DD' })
    to?: string;

    /** Número = código del vale u orden; texto = nombre del empleado. */
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    /** Agrega `filters` (motivos) solo en la primera carga. */
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    includeFilters?: boolean;
}