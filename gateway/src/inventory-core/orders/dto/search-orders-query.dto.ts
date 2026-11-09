import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchOrdersQueryDto {
    @IsOptional()
    @IsString({ message: 'La búsqueda debe ser texto.' })
    @MaxLength(100, { message: 'La búsqueda no puede superar los 100 caracteres.' })
    search?: string;
}