import { IsNotEmpty, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetCashierDashboardRangeDto {

  @IsNotEmpty()
  @IsDateString()
  @Transform(({ value }) => value?.trim())
  from: string = '';

  @IsNotEmpty()
  @IsDateString()
  @Transform(({ value }) => value?.trim())
  to: string = '';
}