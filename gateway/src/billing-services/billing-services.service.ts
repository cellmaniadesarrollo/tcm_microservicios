import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import {
  CreateServiceGatewayDto, CreateServiceTypeGatewayDto, ListServicesQueryDto,
  UpdateServiceGatewayDto, UpdateServiceTypeGatewayDto,
} from './dto/billing-services.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class BillingServicesService {
  constructor(private readonly billing: BillingServiceClient) {}

  // ── Tipos ──
  createType(dto: CreateServiceTypeGatewayDto, u: UserCtx) {
    return this.billing.send('services.types.create', { companyId: u.companyId, userId: u.userId, dto });
  }
  listTypes(onlyActive: boolean | undefined, u: UserCtx) {
    return this.billing.send('services.types.list', { companyId: u.companyId, onlyActive });
  }
  updateType(id: string, dto: UpdateServiceTypeGatewayDto, u: UserCtx) {
    return this.billing.send('services.types.update', { companyId: u.companyId, userId: u.userId, id, dto });
  }
  setTypeActive(id: string, isActive: boolean, u: UserCtx) {
    return this.billing.send('services.types.setActive', { companyId: u.companyId, userId: u.userId, id, isActive });
  }

  // ── Servicios ──
  create(dto: CreateServiceGatewayDto, u: UserCtx) {
    return this.billing.send('services.create', { companyId: u.companyId, userId: u.userId, dto });
  }
  update(id: string, dto: UpdateServiceGatewayDto, u: UserCtx) {
    return this.billing.send('services.update', { companyId: u.companyId, userId: u.userId, id, dto });
  }
  setActive(id: string, isActive: boolean, u: UserCtx) {
    return this.billing.send('services.setActive', { companyId: u.companyId, userId: u.userId, id, isActive });
  }
  list(q: ListServicesQueryDto, u: UserCtx) {
    return this.billing.send('services.list', { ...q, companyId: u.companyId });
  }
  get(id: string, u: UserCtx) {
    return this.billing.send('services.get', { companyId: u.companyId, id });
  }
}