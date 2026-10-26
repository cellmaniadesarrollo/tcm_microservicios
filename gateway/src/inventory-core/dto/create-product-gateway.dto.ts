// gateway/src/inventory-core/dto/create-product-gateway.dto.ts
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsNumber,
    IsOptional, IsString, IsUUID, MaxLength, Min,
} from 'class-validator';
import { BillingMode, TrackingMode } from '../enums/product.enums';

export class CreateProductGatewayDto {
    @IsUUID('4', { message: 'El nombre del producto no es válido' })
    productNameId!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    upc?: string;

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

    // ───────── Dónde puede usarse ─────────

    @IsArray({ message: 'Los usos deben ser una lista' })
    @ArrayMinSize(1, { message: 'Selecciona al menos un uso' })
    @ArrayUnique()
    @IsUUID('4', { each: true, message: 'Cada uso debe ser un UUID válido' })
    usageIds!: string[];

    // ───────── Inventario ─────────

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El stock mínimo debe ser un entero' })
    @Min(0)
    minStock?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Los días de garantía deben ser un entero' })
    @Min(0)
    warrantyDays?: number;

    /** Modelos compatibles (models.models_id). Un DEVICE requiere exactamente uno. */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @Type(() => Number)
    @IsInt({ each: true, message: 'Cada modelo debe ser un ID entero' })
    modelIds?: number[];
}