import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderFindingDto {
  @IsNumber()
  orderId: number;

  @IsString()
  title: string;

  @IsString()
  description: string;

 
}
