import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export enum PrinterType {
    DYMO = 'DYMO',
    ZEBRA = 'ZEBRA',
}

export class PrintLabelItemDto {
    @IsUUID('4', { message: 'El lote no es válido' })
    lotId!: string;

    @Type(() => Number)
    @IsInt({ message: 'La cantidad debe ser un número entero' })
    @Min(1, { message: 'La cantidad mínima es 1' })
    @Max(999, { message: 'La cantidad máxima es 999' })
    cant!: number;
}

export class PrintLabelsDto {
    @IsEnum(PrinterType, { message: 'La impresora no es válida' })
    printer!: PrinterType;

    @IsArray({ message: 'Indica las etiquetas a imprimir' })
    @ArrayMinSize(1, { message: 'Indica al menos una etiqueta' })
    @ArrayMaxSize(50, { message: 'Máximo 50 etiquetas por solicitud' })
    @ValidateNested({ each: true })
    @Type(() => PrintLabelItemDto)
    items!: PrintLabelItemDto[];
}