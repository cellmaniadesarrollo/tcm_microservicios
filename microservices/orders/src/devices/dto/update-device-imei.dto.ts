// update-device-imei.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { UpdateImeiDto } from './update-device.dto';

export class UpdateDeviceImeiDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateImeiDto)
    imeis!: UpdateImeiDto[];

    @IsOptional()
    @IsBoolean()
    forceLink?: boolean;
}