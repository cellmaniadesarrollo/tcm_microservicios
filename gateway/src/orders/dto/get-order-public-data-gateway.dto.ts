// dto/get-order-public-data-gateway.dto.ts
import { IsUUID } from 'class-validator';

export class GetOrderPublicDataGatewayDto {
    @IsUUID()
    publicId: string;
}