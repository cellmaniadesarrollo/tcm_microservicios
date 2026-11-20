import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber,
  IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class InvoiceLineGatewayDto {
  @IsString() @IsNotEmpty() @MaxLength(25) mainCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) description!: string;

  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) unitPrice!: number;
  @IsOptional() @IsUUID('4') discountId?: string;

  @IsString() @MaxLength(2) vatRateCode!: string;
}

export class InvoicePaymentGatewayDto {
  @IsIn(['01', '15', '16', '17', '18', '19', '20', '21'])
  methodCode!: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsOptional() @IsInt() @Min(0) term?: number;
  @IsOptional() @IsString() @MaxLength(10) timeUnit?: string;
}

export class CreateInvoiceGatewayDto {
  @IsUUID('4', { message: 'El identificador de solicitud no es válido' })
  clientRequestId!: string;

  @IsUUID('4', { message: 'La sucursal no es válida' })
  branchId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe ser YYYY-MM-DD' })
  issueDate!: string;

  @IsOptional() @IsUUID('4') orderId?: string;

  @IsIn(['04', '05', '06', '07', '08'], { message: 'Tipo de identificación no válido' })
  buyerIdTypeCode!: string;

  @IsString() @IsNotEmpty() @MaxLength(20) buyerIdNumber!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) buyerName!: string;
  @IsOptional() @IsString() @MaxLength(300) buyerAddress?: string;
  @IsOptional() @IsEmail() @MaxLength(255) buyerEmail?: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => InvoiceLineGatewayDto)
  lines!: InvoiceLineGatewayDto[];

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => InvoicePaymentGatewayDto)
  payments!: InvoicePaymentGatewayDto[];

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) tip?: number;
}