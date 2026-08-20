import {
    IsInt,
    IsPositive,
    IsOptional,
    IsString,
    IsBoolean,
    Min,
    ValidateNested,
    IsDefined
} from 'class-validator';
import { Type } from 'class-transformer';

export class BillingSnapshotDto {
    @IsString()
    id: string;

    @IsString()
    name: string;

    @IsString()
    idNumber: string;
}

export class CloseOrderGatewayDto {
    @IsInt()
    @IsPositive()
    orderId: number;

    @IsOptional()
    @IsInt()
    receivedByCustomerId?: number; // ID del cliente si está registrado en cache

    @IsOptional()
    @IsString()
    receivedByName?: string; // Nombre manual si no es cliente registrado

    @IsOptional()
    @IsBoolean()
    signatureCollected?: boolean = false;

    @IsOptional()
    @IsInt()
    paymentMethodId?: number;

    @Min(0, { message: 'El monto final debe ser mayor o igual a cero' })
    amount?: number;

    @IsOptional()
    @IsString()
    closureObservation?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => BillingSnapshotDto)
    billing?: BillingSnapshotDto; // 👈 Objeto agrupado con validación anidada
}