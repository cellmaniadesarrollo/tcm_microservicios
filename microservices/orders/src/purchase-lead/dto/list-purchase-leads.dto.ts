import { IsOptional, IsString, IsBoolean, IsUUID, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListPurchaseLeadsDto {
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  search?: string; // busca en nombre, apellido, cédula, IMEI

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_contacted?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_closed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  brand_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  model_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}