import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) { }

  // Crear BillingData y vincularlo al cliente
  @MessagePattern({ cmd: 'create_billing' })
  create(@Payload() data: any) {
    return this.billingService.create(data);
  }

  // Editar campos de un BillingData
  @MessagePattern({ cmd: 'update_billing' })
  update(@Payload() data: any) {
    return this.billingService.update(data);
  }

  // Vincular un BillingData existente a otro cliente
  @MessagePattern({ cmd: 'link_billing_to_customer' })
  link(@Payload() data: any) {
    return this.billingService.linkToCustomer(data);
  }

  // Desvincular BillingData de un cliente
  @MessagePattern({ cmd: 'unlink_billing_from_customer' })
  unlink(@Payload() data: any) {
    return this.billingService.unlinkFromCustomer(data);
  }

  // Obtener todos los BillingData de un cliente
  @MessagePattern({ cmd: 'get_billing_by_customer' })
  getByCustomer(@Payload() data: any) {
    return this.billingService.getByCustomer(data);
  }
  @MessagePattern({ cmd: 'search_billing' })
  search(@Payload() data: any) {
    return this.billingService.search(data);
  }

  @MessagePattern('legacy_create_billing')
  async handleLegacyBilling(@Payload() data: any) {
    return this.billingService.createFromLegacy(data);
  }
}