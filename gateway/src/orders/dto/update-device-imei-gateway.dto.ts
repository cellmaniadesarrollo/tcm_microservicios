import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';

// DTO interno para validar cada ítem del arreglo de IMEIs
export class ImeiItemDto {
    @IsOptional()
    @IsInt()
    @IsPositive()
    imei_id?: number;

    @IsNotEmpty()
    @IsString()
    @MaxLength(20)
    imei_number!: string;
}

// DTO principal para el Gateway
export class UpdateDeviceImeiGatewayDto {
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    deviceId!: number;

    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    orderId!: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImeiItemDto) // 👈 Vincula el array con la clase ImeiItemDto
    imeis!: ImeiItemDto[];

    @IsOptional()
    @IsBoolean()
    forceLink?: boolean;
}