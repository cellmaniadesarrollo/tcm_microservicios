// gateway/src/orders/dto/list-part-request-travel-items-gateway.dto.ts
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPartRequestTravelItemsGatewayDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La página debe ser un número entero' })
    @Min(1, { message: 'La página debe ser mayor a 0' })
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El límite debe ser un número entero' })
    @Min(1, { message: 'El límite debe ser mayor a 0' })
    @Max(100, { message: 'El límite máximo es 100' })
    limit?: number;

    @IsOptional()
    @IsString({ message: 'El estado debe ser una cadena de texto' })
    @IsIn(['PENDIENTE', 'RECOGIDO', 'NO_ENCONTRADO', 'CANCELADO'], {
        message: 'Estado inválido',
    })
    status?: 'PENDIENTE' | 'RECOGIDO' | 'NO_ENCONTRADO' | 'CANCELADO';

    @IsOptional()
    @IsString({ message: 'El modo debe ser una cadena de texto' })
    @IsIn(['BUY_CASH', 'PICKUP_PAID'], { message: 'El modo debe ser BUY_CASH o PICKUP_PAID' })
    mode?: 'BUY_CASH' | 'PICKUP_PAID';

    @IsOptional()
    @IsString({ message: 'La búsqueda debe ser una cadena de texto' })
    search?: string;
}