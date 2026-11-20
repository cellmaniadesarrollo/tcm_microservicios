import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class SearchDiscountsQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsIn(['FACTURA', 'RECIBO', 'RETORNO', 'NOTA_CREDITO', 'NOTA_DEBITO'])
  documentType?: 'FACTURA' | 'RECIBO' | 'RETORNO' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  @IsOptional() @IsIn(['NORMAL', 'CREDITO']) type?: 'NORMAL' | 'CREDITO';
  @IsOptional() @IsUUID() createdBy?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}