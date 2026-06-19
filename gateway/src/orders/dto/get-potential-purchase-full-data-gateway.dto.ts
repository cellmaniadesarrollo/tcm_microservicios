// orders/dto/get-potential-purchase-full-data-gateway.dto.ts
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetPotentialPurchaseFullDataGatewayDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    id!: number;
}