import { IsInt, IsPositive } from 'class-validator';

export class GetDeviceByIdGatewayDto {
  @IsInt()
  @IsPositive()
  deviceId: number;
}
