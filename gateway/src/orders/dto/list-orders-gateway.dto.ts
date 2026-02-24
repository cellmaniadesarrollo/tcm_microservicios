import {
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListOrdersGatewayDto {
  @IsInt()
  @Min(1)
  page: number;

  @IsInt()
  @Min(1)
  limit: number;

  @IsOptional()
  @IsString()
  search?: string; // "" = todos

  @IsOptional()
  @IsInt()
  orderTypeId?: number; // 0 = todos

  @IsOptional()
  @IsInt()
  orderStatusId?: number; // 0 = todos
}
