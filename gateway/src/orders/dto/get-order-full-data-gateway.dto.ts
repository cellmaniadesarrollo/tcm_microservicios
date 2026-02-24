import { IsInt, Min } from 'class-validator';

export class GetOrderFullDataGatewayDto {
  @IsInt()
  @Min(1)
  orderId: number;
}