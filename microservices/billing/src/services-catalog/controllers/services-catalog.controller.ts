import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ServicesCatalogService } from '../services/services-catalog.service';

type Ctx = { companyId: string; userId: string };

@Controller()
export class ServicesCatalogController {
  constructor(private readonly svc: ServicesCatalogService) {}

  // ── Tipos ──
  @MessagePattern({ cmd: 'services.types.create' })
  createType(@Payload() d: Ctx & { dto: any }) {
    return this.svc.createType({ ...d.dto, companyId: d.companyId, createdBy: d.userId });
  }

  @MessagePattern({ cmd: 'services.types.list' })
  listTypes(@Payload() d: { companyId: string; onlyActive?: boolean }) {
    return this.svc.listTypes(d.companyId, d.onlyActive);
  }

  @MessagePattern({ cmd: 'services.types.update' })
  updateType(@Payload() d: Ctx & { id: string; dto: any }) {
    return this.svc.updateType({ ...d.dto, companyId: d.companyId, id: d.id });
  }

  @MessagePattern({ cmd: 'services.types.setActive' })
  setTypeActive(@Payload() d: Ctx & { id: string; isActive: boolean }) {
    return this.svc.setTypeActive({
      companyId: d.companyId, id: d.id, updatedBy: d.userId, isActive: d.isActive,
    });
  }

  // ── Servicios ──
  @MessagePattern({ cmd: 'services.create' })
  create(@Payload() d: Ctx & { dto: any }) {
    return this.svc.create({ ...d.dto, companyId: d.companyId, createdBy: d.userId });
  }

  @MessagePattern({ cmd: 'services.update' })
  update(@Payload() d: Ctx & { id: string; dto: any }) {
    return this.svc.update({ ...d.dto, companyId: d.companyId, id: d.id, updatedBy: d.userId });
  }

  @MessagePattern({ cmd: 'services.setActive' })
  setActive(@Payload() d: Ctx & { id: string; isActive: boolean }) {
    return this.svc.setActive({
      companyId: d.companyId, id: d.id, updatedBy: d.userId, isActive: d.isActive,
    });
  }

  @MessagePattern({ cmd: 'services.list' })
  list(@Payload() d: { companyId: string; serviceTypeId?: string; q?: string; onlyActive?: boolean }) {
    return this.svc.list(d);
  }

  @MessagePattern({ cmd: 'services.get' })
  get(@Payload() d: { companyId: string; id: string }) {
    return this.svc.get(d.companyId, d.id);
  }

  @MessagePattern({ cmd: 'services.getForInvoice' })
  getForInvoice(@Payload() d: { companyId: string; id: string }) {
    return this.svc.getForInvoice(d.companyId, d.id);
  }
}