import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDiscountGatewayDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @IsIn(['NORMAL', 'CREDITO'])
  type!: 'NORMAL' | 'CREDITO';

  @IsIn(['PERCENT', 'AMOUNT'])
  valueKind!: 'PERCENT' | 'AMOUNT';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  value!: number;
}