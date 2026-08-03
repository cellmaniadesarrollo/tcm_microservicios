import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ChangeOrderStatusDto {
  @IsNumber()
  orderId: number;

  @IsNumber()
  toStatusId: number;

  @IsOptional()
  @IsString()
  observation?: string;
}
