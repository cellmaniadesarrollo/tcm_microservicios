import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { CreateReceiptGatewayDto } from './dto/create-receipt-gateway.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class ReceiptsService {
  constructor(private readonly billing: BillingServiceClient) {}

  create(dto: CreateReceiptGatewayDto, user: UserCtx) {
    return this.billing.send('create_receipt', { dto, user });
  }

  list(user: UserCtx) {
    return this.billing.send('list_receipts', { user });
  }
}