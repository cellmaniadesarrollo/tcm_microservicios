import { Type } from 'class-transformer';
import {
  IsArray, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CorrectLineGatewayDto {
  @IsUUID() id!: string;
  @IsString() @IsNotEmpty() @MaxLength(25) mainCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) description!: string;
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) @Max(9999999) unitPrice!: number;
  @IsString() @IsNotEmpty() @MaxLength(5) vatRateCode!: string;
}

export class CorrectInvoiceGatewayDto {
  @IsString() @IsNotEmpty() @MaxLength(2) buyerIdTypeCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(20) buyerIdNumber!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) buyerName!: string;
  @IsOptional() @IsString() @MaxLength(300) buyerAddress?: string;
  @IsOptional() @IsEmail() buyerEmail?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectLineGatewayDto)
  lines?: CorrectLineGatewayDto[];
}