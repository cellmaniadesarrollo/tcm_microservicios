// gateway/src/orders/dto/tomar-part-request-gateway.dto.ts
import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TomarPartRequestGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser un entero positivo mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;
}