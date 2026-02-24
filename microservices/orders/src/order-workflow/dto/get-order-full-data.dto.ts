import { IsInt, Min } from 'class-validator';

export class GetOrderFullDataDto  {
  @IsInt()
  @Min(1)
  orderId: number;
}