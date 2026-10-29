import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListProductsQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number = 1;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number = 20;

    @IsOptional() @IsString() @MaxLength(100)
    search?: string;

    @IsOptional() @IsUUID()
    productTypeId?: string;

    @IsOptional() @IsIn(['DEVICE', 'PART', 'ACCESSORY'])
    kind?: 'DEVICE' | 'PART' | 'ACCESSORY';

    /** Uso del producto (product_usages.id) */
    @IsOptional() @IsUUID()
    usageId?: string;

    @IsOptional() @IsIn(['createdAt', 'code', 'sku', 'name', 'basePrice'])
    sortBy?: 'createdAt' | 'code' | 'sku' | 'name' | 'basePrice';

    @IsOptional() @IsIn(['ASC', 'DESC'])
    sortDir?: 'ASC' | 'DESC';

    @IsOptional() @IsUUID('4', { message: 'La calidad no es válida' })
    qualityId?: string;

    @IsOptional() @IsIn(['QUANTITY', 'SERIAL'], { message: 'El modo de seguimiento no es válido' })
    trackingMode?: 'QUANTITY' | 'SERIAL';

    @IsOptional() @IsIn(['OUT', 'LOW', 'OK'], { message: 'El estado de stock no es válido' })
    stockStatus?: 'OUT' | 'LOW' | 'OK';

    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    includeFilters?: boolean;
}