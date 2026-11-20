import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsNumber,
  IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class ReceiptLineGatewayDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() lotId?: string;
  @IsOptional() @IsUUID() unitId?: string;

  @IsString() @IsNotEmpty() @MaxLength(25) mainCode!: string;
  @IsOptional() @IsString() @MaxLength(50) batch?: string;
  @IsString() @IsNotEmpty() @MaxLength(300) description!: string;

  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) unitPrice!: number;
  @IsOptional() @IsUUID('4') discountId?: string;
}

export class CreateReceiptGatewayDto {
  @IsUUID('4', { message: 'El identificador de solicitud no es válido' })
  clientRequestId!: string;

  @IsUUID('4', { message: 'La sucursal no es válida' })
  branchId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe ser YYYY-MM-DD' })
  issueDate!: string;

  @IsOptional() @IsString() @MaxLength(20) buyerIdNumber?: string;
  @IsOptional() @IsString() @MaxLength(300) buyerName?: string;

  @IsIn(['01', '15', '16', '17', '18', '19', '20', '21'], { message: 'Forma de pago no válida' })
  paymentMethod!: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) total!: number;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => ReceiptLineGatewayDto)
  lines!: ReceiptLineGatewayDto[];
}