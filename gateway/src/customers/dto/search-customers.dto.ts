import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SearchCustomersDto {
  @IsNumber()
  page: number;

  @IsNumber()
  limit: number;

  @IsOptional()
  @IsString()
  search?: string;
}
