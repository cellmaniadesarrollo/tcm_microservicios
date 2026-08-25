// create-warehouse-payment.dto.ts (microservicio)
export class CreateWarehousePaymentDto {
    orderId: number;
    amount: number;
    paymentTypeId: number;
    paymentMethodId: number;
    reference?: string;
    observation?: string;
}