import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { CreateIssuerGatewayDto, UpdateIssuerGatewayDto } from './dto/create-issuer-gateway.dto';
import { CreateEmissionPointGatewayDto, SetEmissionPointUsersGatewayDto, UpdateEmissionPointGatewayDto } from './dto/emission-point-gateway.dto';

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

  listEmissionPoints(branchId: string, user: UserCtx) {
    return this.billing.send('list_emission_points', { branchId, user });
  }

  createEmissionPoint(branchId: string, dto: CreateEmissionPointGatewayDto, user: UserCtx) {
    return this.billing.send('create_emission_point', { branchId, dto, user });
  }

  updateEmissionPoint(id: string, dto: UpdateEmissionPointGatewayDto, user: UserCtx) {
    return this.billing.send('update_emission_point', { id, dto, user });
  }

  listMyEmissionPoints(branchId: string, user: UserCtx) {
    return this.billing.send('list_my_emission_points', { branchId, user });
  }

  getEmissionPointUsers(id: string, user: UserCtx) {
    return this.billing.send('get_emission_point_users', { id, user });
  }

  setEmissionPointUsers(id: string, dto: SetEmissionPointUsersGatewayDto, user: UserCtx) {
    return this.billing.send('set_emission_point_users', { id, dto, user });
  }
}