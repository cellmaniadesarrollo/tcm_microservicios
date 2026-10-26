import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BillingService } from './billing.service';
import { OrdersPinService, Signer } from '../pin/orders-pin.service';

@Controller()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly ordersPin: OrdersPinService,
  ) {}

  /** Mismo criterio que en CustomersController: se resuelve una sola vez */
  private async getSigner(user: any, pin?: string): Promise<Signer> {
    if ((user?.source ?? 'ORDERS') === 'BILLING') {
      return {
        id: String(user?.sub ?? user?.id ?? ''),
        username: user?.username ?? user?.name ?? '',
      };
    }
    return this.ordersPin.resolveSigner(user, pin);
  }

  // Crear BillingData y vincularlo al cliente
  @MessagePattern({ cmd: 'create_billing' })
  async create(@Payload() data: any) {
    const { pin, ...rest } = data; // 🔐 el PIN no viaja al service
    const signer = await this.getSigner(rest.user, pin);
    return this.billingService.create({ ...rest, signer });
  }

  // Editar campos de un BillingData
  @MessagePattern({ cmd: 'update_billing' })
  async update(@Payload() data: any) {
    const { pin, ...rest } = data;
    const signer = await this.getSigner(rest.user, pin);
    return this.billingService.update({ ...rest, signer });
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
    // El firmante (puede ser null) ya viene resuelto desde el gateway
    return this.billingService.createFromLegacyRaw(data);
  }

  @MessagePattern('legacy_update_billing')
  async handleLegacyBillingUpdate(@Payload() data: any) {
    // 🔐 quitado el console.log(data): puede traer datos sensibles
    return this.billingService.updateFromLegacyRaw(data);
  }

  @MessagePattern({ cmd: 'create_customer_with_billing' })
  async createWithBilling(@Payload() data: any) {
    const { pin, ...rest } = data; // 🔐 el PIN no viaja al service
    const signer = await this.getSigner(rest.user, pin);
    return this.billingService.createCustomerWithBilling({ ...rest, signer });
  }
}