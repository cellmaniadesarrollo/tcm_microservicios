import { Type } from 'class-transformer';
import {
    IsArray, IsDateString, IsInt, IsNumber, IsObject,
    IsOptional, IsPositive, IsString, MaxLength, ValidateNested,
} from 'class-validator';

export interface SerializedFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: string; // base64
}

export class UserCtxDto {
    @IsString() userId!: string;
    @IsString() companyId!: string;
}

export class CreateDevicePurchaseDto {
    @IsInt() order_id!: number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    amount!: number; // hoy = total y pago único

    @IsInt() payment_method_id!: number;
    @IsOptional() @IsString() @MaxLength(100) payment_reference?: string;
    @IsOptional() @IsDateString() paid_at?: string;
    @IsOptional() @IsString() notes?: string;

    @IsOptional()
    @IsArray()
    files?: SerializedFile[];

    @IsObject() @ValidateNested() @Type(() => UserCtxDto)
    user!: UserCtxDto;
}

export class AddPurchasePaymentDto {
    @IsInt() purchase_id!: number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    amount!: number;

    @IsInt() payment_method_id!: number;
    @IsOptional() @IsString() @MaxLength(100) payment_reference?: string;
    @IsOptional() @IsDateString() paid_at?: string;
    @IsOptional() @IsString() notes?: string;

    @IsObject() @ValidateNested() @Type(() => UserCtxDto)
    user!: UserCtxDto;
}

export class ListDevicePurchasesDto {
    @Type(() => Number) @IsInt() page: number = 1;
    @Type(() => Number) @IsInt() limit: number = 20;
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsDateString() from?: string;
    @IsOptional() @IsDateString() to?: string;
    @IsOptional() @Type(() => Number) @IsInt() payment_method_id?: number;
}