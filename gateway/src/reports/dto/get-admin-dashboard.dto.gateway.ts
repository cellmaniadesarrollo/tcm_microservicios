import { IsNotEmpty, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetAdminDashboardRangeDto {

  @IsNotEmpty()
  @IsDateString()
  @Transform(({ value }) => value?.trim())
  from: string = '';        // valor por defecto

  @IsNotEmpty()
  @IsDateString()
  @Transform(({ value }) => value?.trim())
  to: string = '';
}