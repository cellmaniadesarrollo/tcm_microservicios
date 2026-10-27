import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchReceiptProductsQueryDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;

    @IsOptional()
    @IsIn(['DEVICE', 'PART', 'ACCESSORY'], { message: 'El tipo de producto no es válido' })
    kind?: 'DEVICE' | 'PART' | 'ACCESSORY';
}