import { IsString, Length } from 'class-validator';

export class CheckWarrantyGatewayDto {
    @IsString()
    @Length(1, 50)
    imei: string;
}