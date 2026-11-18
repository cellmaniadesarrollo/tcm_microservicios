import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { CreateIssuerGatewayDto, UpdateIssuerGatewayDto } from './dto/create-issuer-gateway.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class IssuersService {
  constructor(private readonly billing: BillingServiceClient) {}

  list(user: UserCtx) {
    return this.billing.send('list_issuers', { user });
  }

  create(dto: CreateIssuerGatewayDto, user: UserCtx) {
    return this.billing.send('create_issuer', { dto, user });
  }

  update(id: string, dto: UpdateIssuerGatewayDto, user: UserCtx) {
    return this.billing.send('update_issuer', { id, dto, user });
  }
}