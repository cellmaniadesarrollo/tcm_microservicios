import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BillingSnapshotDto {
    id: string;
    name: string;
    idNumber: string;
}

export class CloseOrderDto {
    orderId: number;
    amount: number;
    paymentMethodId?: number;
    receivedByCustomerId?: number;
    receivedByName?: string;
    signatureCollected?: boolean;
    closureObservation?: string;
    billing?: BillingSnapshotDto;

    @IsOptional()
    @IsString()
    @MaxLength(60)
    transferNumber?: string; // 👈 nuevo: obligatorio si el método es TRANSFERENCIA (se valida en el service)
}