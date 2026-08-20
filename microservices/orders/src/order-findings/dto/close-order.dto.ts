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
    billing?: BillingSnapshotDto;   // 👈 objeto agrupado
}