// src/orders/invoices/invoices-gateway.service.ts
import { Injectable } from '@nestjs/common';
import { OrderServiceClient } from '../../common/microservices/order-service-client';
import { ListInvoicesGatewayDto } from './dto/list-invoices-gateway.dto';

@Injectable()
export class InvoicesGatewayService {
    constructor(private readonly orderServiceClient: OrderServiceClient) { }

    async listInvoices(dto: ListInvoicesGatewayDto, user: any) {
        // el try/catch de mapeo de errores ya vive en send(), igual que en OrdersGatewayService
        return this.orderServiceClient.send('list_invoices', { dto, user });
    }

    async resendInvoice(invoiceId: number, user: any) {
        return this.orderServiceClient.send('resend_invoice', { invoiceId, user });
    }
}