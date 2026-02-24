// dto/close-order-gateway.dto.ts
import { IsInt, IsPositive, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CloseOrderGatewayDto {
    @IsInt()
    @IsPositive()
    orderId: number;

    @IsOptional()
    @IsInt()
    receivedByCustomerId?: number;         // ID del cliente si está registrado en cache

    @IsOptional()
    @IsString()
    receivedByName?: string;               // Nombre manual si no es cliente registrado

    @IsOptional()
    @IsBoolean()
    signatureCollected?: boolean = false;

    @IsOptional()
    @IsInt()
    paymentMethodId?: number;

    @IsPositive({ message: 'El monto final debe ser mayor que cero' })
    amount: number;

    @IsOptional()
    @IsString()
    closureObservation?: string;
}