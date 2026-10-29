import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE_MSG = 'La fecha debe tener formato AAAA-MM-DD';

export class ListReceiptsQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number;

    @IsOptional() @IsString() @MaxLength(100)
    search?: string;

    @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MSG })
    dateFrom?: string;

    @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MSG })
    dateTo?: string;

    @IsOptional() @IsIn(['REGISTERED', 'VERIFIED', 'VOIDED'], { message: 'El estado no es válido' })
    status?: 'REGISTERED' | 'VERIFIED' | 'VOIDED';

    @IsOptional() @IsIn(['UNPAID', 'PARTIAL', 'PAID'], { message: 'El estado de pago no es válido' })
    paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';

    @IsOptional() @IsUUID('4', { message: 'El tipo de documento no es válido' })
    documentTypeId?: string;

    @IsOptional() @IsUUID('4', { message: 'El producto no es válido' })
    productId?: string;

    @IsOptional() @IsIn(['issueDate', 'code', 'total', 'createdAt'])
    sortBy?: 'issueDate' | 'code' | 'total' | 'createdAt';

    @IsOptional() @IsIn(['ASC', 'DESC'])
    sortDir?: 'ASC' | 'DESC';

    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    includeFilters?: boolean;
}