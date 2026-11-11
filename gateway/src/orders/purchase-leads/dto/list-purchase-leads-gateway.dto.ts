// dto/list-purchase-leads-gateway.dto.ts
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toBool = ({ value }: { value: any }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined;

export class ListPurchaseLeadsGatewayDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @Transform(toBool) @IsBoolean()
  is_contacted?: boolean;

  @IsOptional() @Transform(toBool) @IsBoolean()
  is_closed?: boolean;
}