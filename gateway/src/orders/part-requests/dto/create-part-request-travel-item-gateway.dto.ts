// gateway/src/orders/dto/create-part-request-travel-item-gateway.dto.ts
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartRequestTravelItemGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID de la solicitud debe ser un número entero' })
    @Min(1, { message: 'El ID de la solicitud debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID de la solicitud es obligatorio' })
    partRequestId!: number;

    @IsString({ message: 'El ID del viajero debe ser una cadena de texto' })
    @IsUUID('4', { message: 'El ID del viajero debe ser un UUID válido' })
    @IsNotEmpty({ message: 'El viajero es obligatorio' })
    travelerId!: string;

    @IsString({ message: 'El modo debe ser una cadena de texto' })
    @IsIn(['BUY_CASH', 'PICKUP_PAID'], { message: 'El modo debe ser BUY_CASH o PICKUP_PAID' })
    @IsNotEmpty({ message: 'El modo es obligatorio' })
    mode!: 'BUY_CASH' | 'PICKUP_PAID';

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La cantidad esperada debe ser un número entero' })
    @Min(1, { message: 'La cantidad esperada debe ser mayor a 0' })
    expectedQuantity?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El ID del proveedor sugerido debe ser un número entero' })
    @Min(1, { message: 'El ID del proveedor sugerido debe ser mayor a 0' })
    suggestedProviderId?: number;

    @IsOptional()
    @IsString({ message: 'Las notas deben ser una cadena de texto' })
    officeNotes?: string;
}