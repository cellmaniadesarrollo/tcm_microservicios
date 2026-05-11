import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy, MessagePattern } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { OrdersRelayService } from './orders-relay.service';

@Controller('orders-relay')
export class OrdersRelayController implements OnModuleInit {
    constructor(
        private readonly ordersRelayService: OrdersRelayService,
        @Inject('ORDERS_ASYNC') private readonly ordersClient: ClientProxy,
    ) { }

    async onModuleInit() {
    console.log('🚀 Iniciando sincronización bulk de órdenes...');

    try {
        await this.syncOrders();
        console.log('✅ Sincronización inicial completada.');
    } catch (err: any) {
        console.error('❌ Error en sincronización inicial:', err.message);
    }
    }

    private async syncOrders() {
    const fromCache = await this.ordersRelayService.getLastUpdatedAt();
    console.log(`🔄 Sincronizando desde: ${fromCache ?? 'el origen del tiempo'}`);

    const response = await firstValueFrom(
        this.ordersClient.send(
        { cmd: 'async_orders_start' },
        {
            internalToken: process.env.INTERNAL_SECRET,
            fromCache,
        },
        ),
    );

    await this.ordersRelayService.syncOrdersBulk(response);
    }


}