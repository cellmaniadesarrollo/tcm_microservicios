// gateway/src/orders/device-purchases/dto/cancel-device-purchase-gateway.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelDevicePurchaseGatewayDto {
    @IsString() @IsNotEmpty() @MaxLength(500)
    reason!: string;
}