import { IsString, Length } from 'class-validator';

export class CheckWarrantyDto {
    @IsString()
    @Length(1, 50)
    imei: string;
}