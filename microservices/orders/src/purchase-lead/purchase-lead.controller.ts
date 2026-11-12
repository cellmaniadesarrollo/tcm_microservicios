import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PurchaseLeadService } from './purchase-lead.service';

@Controller()
export class PurchaseLeadController {
  constructor(private readonly service: PurchaseLeadService) {}

  @MessagePattern({ cmd: 'create_purchase_lead' })
  create(@Payload() { dto, user }: any) {
    return this.service.create(dto, user);
  }

  @MessagePattern({ cmd: 'list_purchase_leads' })
  list(@Payload() { dto, user }: any) {
    return this.service.findAll(dto, user.companyId);
  }

  @MessagePattern({ cmd: 'get_purchase_lead' })
  getOne(@Payload() { dto, user }: any) {
    return this.service.findOne(dto.id, user.companyId);
  }

  @MessagePattern({ cmd: 'upload_purchase_lead_photos' })
  uploadPhotos(@Payload() { dto, user }: any) {
    return this.service.uploadPhotos(dto, user);
  }

  @MessagePattern({ cmd: 'mark_purchase_lead_contacted' })
  markContacted(@Payload() { dto, user }: any) {
    const { id, ...rest } = dto;
    return this.service.markContacted(id, rest, user.companyId);
  }

  @MessagePattern({ cmd: 'close_purchase_lead' })
  markClosed(@Payload() { dto, user }: any) {
    return this.service.markClosed(dto.id, user.companyId);
  }

  @MessagePattern({ cmd: 'delete_purchase_lead' })
  remove(@Payload() { dto, user }: any) {
    return this.service.remove(dto.id, user.companyId);
  }
}