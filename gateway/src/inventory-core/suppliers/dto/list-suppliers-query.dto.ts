import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { IdentificationType } from '../enums/supplier.enums';

export class ListSuppliersQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number = 1;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number = 20;

    /** Razón social, nombre comercial, identificación o código */
    @IsOptional() @IsString() @MaxLength(100)
    search?: string;

    @IsOptional()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    @IsBoolean()
    status?: boolean;

    @IsOptional() @IsEnum(IdentificationType)
    identificationType?: IdentificationType;

    @IsOptional() @IsUUID()
    countryId?: string;

    @IsOptional() @IsIn(['createdAt', 'code', 'name', 'identification'])
    sortBy?: 'createdAt' | 'code' | 'name' | 'identification';

    @IsOptional() @IsIn(['ASC', 'DESC'])
    sortDir?: 'ASC' | 'DESC';
}