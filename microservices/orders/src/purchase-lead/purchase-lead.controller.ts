// microservices/orders/src/purchase-lead/purchase-lead.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PurchaseLeadService } from './purchase-lead.service';

@Controller()
export class PurchaseLeadController {
  constructor(private readonly service: PurchaseLeadService) {}

  @MessagePattern({ cmd: 'create_purchase_lead' })
  create(data: { dto: any; user: any }) {
    return this.service.create(data.dto, data.user);
  }

  @MessagePattern({ cmd: 'list_purchase_leads' })
  findAll(data: { dto: any; user: any }) {
    return this.service.findAll(data.dto, data.user.companyId);
  }

  @MessagePattern({ cmd: 'get_purchase_lead' })
  findOne(data: { dto: { id: number }; user: any }) {
    return this.service.findOne(data.dto.id, data.user.companyId);
  }

  @MessagePattern({ cmd: 'mark_purchase_lead_contacted' })
  markContacted(data: { dto: any; user: any }) {
    return this.service.markContacted(data.dto.id, data.dto, data.user.companyId);
  }

  @MessagePattern({ cmd: 'close_purchase_lead' })
  markClosed(data: { dto: { id: number }; user: any }) {
    return this.service.markClosed(data.dto.id, data.user.companyId);
  }

  @MessagePattern({ cmd: 'delete_purchase_lead' })
  remove(data: { dto: { id: number }; user: any }) {
    return this.service.remove(data.dto.id, data.user.companyId);
  }
}