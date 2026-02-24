import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderFindingGatewayDto {
  @IsNumber()
  orderId: number;

  @IsString()
  description: string;


}
