import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsNumber,
  IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CreditNoteLineGatewayDto {
  @IsUUID('4', { message: 'La línea de la factura no es válida' })
  sourceLineId!: string;

  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001)
  quantity!: number;
}

export class CreateCreditNoteGatewayDto {
  @IsUUID('4', { message: 'El identificador de solicitud no es válido' })
  clientRequestId!: string;

  @IsUUID('4', { message: 'La factura no es válida' })
  modifiedDocumentId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe ser YYYY-MM-DD' })
  issueDate!: string;

  @IsString() @IsNotEmpty() @MaxLength(300)
  reason!: string;

  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => CreditNoteLineGatewayDto)
  lines?: CreditNoteLineGatewayDto[];

  /** true = devolución física: reingresa el stock cuando el SRI autorice la NC. */
  @IsOptional() @IsBoolean()
  returnStock?: boolean;
}