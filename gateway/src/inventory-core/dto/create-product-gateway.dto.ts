// gateway/src/inventory-core/dto/create-product-gateway.dto.ts
import { Type } from 'class-transformer';
import {
    ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber,
    IsOptional, IsString, IsUUID, MaxLength, Min,
} from 'class-validator';
import { BillingMode, TrackingMode } from '../enums/product.enums';

export class CreateProductGatewayDto {
    @IsString({ message: 'El nombre debe ser un texto' })
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @MaxLength(255)
    name!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    upc?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    imageUrl?: string;

    @IsUUID('4', { message: 'El tipo de producto no es válido' })
    productTypeId!: string;

    @IsOptional()
    @IsUUID('4', { message: 'El color no es válido' })
    colorId?: string;

    @IsOptional()
    @IsUUID('4', { message: 'La calidad no es válida' })
    qualityId?: string;

    @IsOptional()
    @IsEnum(TrackingMode, { message: 'El modo de seguimiento no es válido' })
    trackingMode?: TrackingMode;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio base debe ser numérico' })
    @Min(0)
    basePrice?: number;

    @IsOptional()
    @IsBoolean()
    hasTax?: boolean;

    @IsOptional()
    @IsEnum(BillingMode, { message: 'El modo de facturación no es válido' })
    billingMode?: BillingMode;

    @IsOptional()
    @IsBoolean()
    billableInRepairOrders?: boolean;

    /** Modelos compatibles (models.models_id). Un DEVICE requiere exactamente uno. */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @Type(() => Number)
    @IsInt({ each: true, message: 'Cada modelo debe ser un ID entero' })
    modelIds?: number[];
}