import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class SaveSearchHistoryDto {
    @IsString()
    @IsNotEmpty()
    searchTerm!: string;

    @IsNumber()
    resultCount?: number;

    @IsString()
    @IsOptional()
    searchType?: string;
}