import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomersService } from './customers.service';
import { AuditService } from '../audit/audit.service';
import { OrdersPinService, Signer } from '../pin/orders-pin.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customerService: CustomersService,
    private readonly audit: AuditService,
    private readonly ordersPin: OrdersPinService,
  ) {}

  /**
   * Quién firma la operación (se resuelve UNA sola vez, aquí).
   * - ORDERS: se valida el PIN contra el MS `users`.
   * - BILLING: facturación ya validó el PIN en su backend y manda el
   *   firmante en `user`.
   * La sesión (`user`) NO se modifica: así la auditoría guarda ambos.
   */
  private async getSigner(user: any, pin?: string): Promise<Signer> {
    if ((user?.source ?? 'ORDERS') === 'BILLING') {
      return {
        id: String(user?.sub ?? user?.id ?? ''),
        username: user?.username ?? user?.name ?? '',
      };
    }
    return this.ordersPin.resolveSigner(user, pin);
  }

  @MessagePattern({ cmd: 'get_all_customers' })
  findAll() {
    return true;
  }

  @MessagePattern({ cmd: 'save_one_customer' })
  async saveOne(data: any) {
    const { pin, ...rest } = data; // 🔐 el PIN no viaja al service
    const signer = await this.getSigner(rest.user, pin);
    return this.customerService.create({ ...rest, signer });
  }

  @MessagePattern({ cmd: 'update_one_customer' })
  async updateOne(data: any) {
    const { id, updates, user, pin } = data;
    const signer = await this.getSigner(user, pin);
    return this.customerService.update(id, updates, user, signer);
  }

  @MessagePattern({ cmd: 'list_customers' })
  async list(@Payload() data: any) {
    const { page, limit, search, user } = data;
    return this.customerService.findPaginated({ page, limit, search }, user);
  }

  // 📜 Historial de un cliente (quién lo creó, quién lo editó y qué cambió)
  @MessagePattern({ cmd: 'get_customer_history' })
  async history(@Payload() data: any) {
    const { id, user } = data;
    return this.audit.getHistory('Customer', id, user.companyId);
  }

  /**
   * 📥 Recibe solicitud de sincronización inicial.
   * Aquí NO se devuelven los datos, solo se inicia la paginación.
   */
  @MessagePattern({ cmd: 'async_customers_start' })
  async onSyncStart(@Payload() payload: any) {
    console.log('🔄 Solicitud de sincronización recibida', payload);
    const data = await this.customerService.getCustomersUpdatedAfter(payload.fromCache);
    return data;
  }
}