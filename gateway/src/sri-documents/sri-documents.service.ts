import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { CreateInvoiceGatewayDto } from './dto/create-invoice-gateway.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class SriDocumentsService {
  constructor(private readonly billing: BillingServiceClient) {}

  createInvoice(dto: CreateInvoiceGatewayDto, user: UserCtx) {
    return this.billing.send('create_invoice', { dto, user });
  }

  list(user: UserCtx) {
    return this.billing.send('list_invoices', { user });
  }
}