// dto/get-order-public-data.dto.ts
import { IsUUID } from 'class-validator';

export class GetOrderPublicDataDto {
    @IsUUID()
    publicId: string;
}