import {
    IsInt,
    IsPositive,
    IsOptional,
    IsString,
    IsBoolean,
    IsNumber,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillingSnapshotDto } from './billing-snapshot.dto';

export class CloseOrderGatewayDto {
    @IsInt()
    @IsPositive()
    orderId: number;

    @IsOptional()
    @IsInt()
    receivedByCustomerId?: number;

    @IsOptional()
    @IsString()
    receivedByName?: string;

    @IsOptional()
    @IsBoolean()
    signatureCollected?: boolean = false;

    @IsOptional()
    @IsInt()
    paymentMethodId?: number;

    @IsOptional()
    @IsString()
    @MaxLength(60)
    transferNumber?: string;

    @IsOptional()
    @IsNumber()
    @Min(0, { message: 'El monto final debe ser mayor o igual a cero' })
    amount?: number;

    @IsOptional()
    @IsString()
    closureObservation?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => BillingSnapshotDto)
    billing?: BillingSnapshotDto;
}