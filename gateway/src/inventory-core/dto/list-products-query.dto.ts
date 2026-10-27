import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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
}