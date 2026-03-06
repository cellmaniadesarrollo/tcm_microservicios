// get-last-orders-by-device-gateway.dto.ts
import { IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class GetLastOrdersByDeviceGatewayDto {
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    deviceId: number;
}