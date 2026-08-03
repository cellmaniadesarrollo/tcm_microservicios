// dto/close-order.dto.ts
export class CloseOrderDto {
    orderId: number;
    receivedByCustomerId?: number;
    receivedByName?: string;
    signatureCollected: boolean;
    paymentMethodId?: number;
    amount: number;
    closureObservation?: string;
}