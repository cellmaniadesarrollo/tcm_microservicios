// gateway/src/orders/dto/resolve-travel-item-gateway.dto.ts
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ResolveTravelItemGatewayDto {
    @IsString()
    @IsIn(['RECOGIDO', 'NO_ENCONTRADO'], { message: 'El resultado debe ser RECOGIDO o NO_ENCONTRADO' })
    @IsNotEmpty({ message: 'El resultado es obligatorio' })
    result!: 'RECOGIDO' | 'NO_ENCONTRADO';

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La cantidad recogida debe ser un número entero' })
    @Min(1, { message: 'La cantidad recogida debe ser mayor a 0' })
    collectedQuantity?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El costo pagado debe tener máximo 2 decimales' })
    @Min(0, { message: 'El costo pagado no puede ser negativo' })
    paidCost?: number;

    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
    @IsString()
    @MaxLength(1000, { message: 'Las notas no pueden superar 1000 caracteres' })
    travelerNotes?: string;
}