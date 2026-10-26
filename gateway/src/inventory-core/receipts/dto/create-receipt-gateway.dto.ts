import { Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber,
    IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

/** Un equipo físico. Un celular con dos IMEI lleva dos valores en `serials`. */
export class ReceiptUnitGatewayDto {
    @IsArray({ message: 'Los seriales deben ser una lista' })
    @ArrayMinSize(1, { message: 'Cada equipo necesita al menos un IMEI/serial' })
    @ArrayMaxSize(4, { message: 'Un equipo admite hasta 4 IMEI/seriales' })
    @IsString({ each: true })
    @IsNotEmpty({ each: true, message: 'Hay un IMEI/serial vacío' })
    @MaxLength(100, { each: true })
    serials!: string[];
}

export class ReceiptLineGatewayDto {
    @IsUUID('4', { message: 'El producto no es válido' })
    productId!: string;

    @Type(() => Number)
    @IsInt({ message: 'La cantidad debe ser un entero' })
    @Min(1) @Max(100000)
    quantity!: number;

    /** Costo unitario SIN impuesto, tal como viene en el documento. */
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El costo debe ser numérico (hasta 4 decimales)' })
    @Min(0) @Max(1000000)
    unitCost!: number;

    /** Descuento TOTAL de la línea (no por unidad). */
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    discount?: number;

    @IsOptional() @IsString() @MaxLength(10)
    purchaseTaxCode?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0) @Max(100)
    purchaseTaxRate?: number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio de venta debe ser numérico' })
    @Min(0) @Max(9999999999.99)
    salePrice!: number;

    @Type(() => Number)
    @IsInt({ message: 'Los días de garantía deben ser un entero' })
    @Min(0)
    warrantyDays!: number;

    @IsOptional() @IsBoolean() hasTax?: boolean;
    @IsOptional() @IsBoolean() priceIncludesTax?: boolean;
    @IsOptional() @IsBoolean() billableInSales?: boolean;
    @IsOptional() @IsBoolean() billableInRepairOrders?: boolean;

    /** Solo productos SERIAL: un elemento por equipo (la cantidad debe coincidir). */
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReceiptUnitGatewayDto)
    units?: ReceiptUnitGatewayDto[];
}

export class CreateReceiptGatewayDto {
    /** UUID generado por el front al abrir el formulario. Hace el guardado idempotente. */
    @IsUUID('4', { message: 'El identificador de solicitud no es válido' })
    clientRequestId!: string;

    @IsUUID('4', { message: 'El proveedor no es válido' })
    supplierId!: string;

    @IsUUID('4', { message: 'El tipo de documento no es válido' })
    documentTypeId!: string;

    @IsOptional() @IsString() @MaxLength(50)
    documentNumber?: string;

    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato AAAA-MM-DD' })
    issueDate!: string;

    @IsOptional() @IsString() @MaxLength(2000)
    notes?: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'Agrega al menos una línea' })
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => ReceiptLineGatewayDto)
    lines!: ReceiptLineGatewayDto[];
}