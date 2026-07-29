import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListOrdersGatewayDto {
  @IsInt()
  @Min(1)
  page!: number;

  @IsInt()
  @Min(1)
  limit!: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  orderTypeId?: number;

  @IsOptional()
  @IsInt()
  orderStatusId?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  myOrdersFilter?: string[];

  // Propiedades agregadas:
  @IsOptional()
  @IsDateString()
  dateFrom?: string | null;

  @IsOptional()
  @IsDateString()
  dateTo?: string | null;
}