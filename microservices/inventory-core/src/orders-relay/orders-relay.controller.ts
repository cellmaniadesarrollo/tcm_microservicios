import { BadRequestException, Controller, Inject, Logger } from '@nestjs/common';
import { OrdersRelayService } from './orders-relay.service';
import { ClientProxy, MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('orders-relay')
export class OrdersRelayController {
  private readonly logger = new Logger(OrdersRelayController.name);

  constructor(
    private readonly ordersRelayService: OrdersRelayService,
    @Inject('ORDERS_ASYNC') private readonly ordersClient: ClientProxy,
  ) { }

  async onModuleInit() {
    this.logger.log('🚀 Iniciando sincronización de órdenes...');
    try {
      await this.syncOrders();
      this.logger.log('✅ Sincronización inicial completada.');
    } catch (err: any) {
      this.logger.error(`❌ Error en el ciclo de inicio: ${err.message}`);
    }
  }

  private async syncOrders() {
    // Tabla vacía => null => el origen manda TODO (así se fuerza la reconciliación)
    const fromCache = await this.ordersRelayService.getLastUpdatedAt();
    this.logger.log(`🔄 Sincronizando órdenes desde: ${fromCache?.toISOString() ?? 'el origen del tiempo'}`);

    const response = await firstValueFrom(
      this.ordersClient.send(
        { cmd: 'async_orders_start' },
        { internalToken: process.env.INTERNAL_SECRET, fromCache },
      ),
    );

    await this.ordersRelayService.syncOrdersBulk(response);
  }

  @MessagePattern({ cmd: 'search_orders' })
  async search(@Payload() data: any) {
    const companyId = data?.user?.companyId;
    if (!companyId) {
      throw new RpcException(new BadRequestException('Empresa no identificada'));
    }
    return this.ordersRelayService.search(companyId, data.search);
  }
}
