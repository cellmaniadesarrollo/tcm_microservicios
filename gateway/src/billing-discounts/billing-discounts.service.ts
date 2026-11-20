import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { CreateDiscountGatewayDto } from './dto/create-discount-gateway.dto';
import { SearchDiscountsQueryDto } from './dto/search-discounts-query.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class BillingDiscountsService {
  constructor(private readonly billing: BillingServiceClient) {}

  listAvailable(user: UserCtx) {
    return this.billing.send('discounts.listAvailable', { companyId: user.companyId });
  }

  create(dto: CreateDiscountGatewayDto, user: UserCtx) {
    return this.billing.send('discounts.create', {
      companyId: user.companyId,
      userId: user.userId,
      dto,
    });
  }

  deactivate(id: string, user: UserCtx) {
    return this.billing.send('discounts.deactivateDiscount', {
      companyId: user.companyId,
      userId: user.userId,
      id,
    });
  }

  report(q: SearchDiscountsQueryDto, user: UserCtx) {
    return this.billing.send('discounts.search', { ...q, companyId: user.companyId });
  }
}