import { Controller, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { OrdersRelayService } from './orders-relay.service';

const REQUEST_TIMEOUT_MS = 60_000;

@Controller('orders-relay')
export class OrdersRelayController implements OnModuleInit {
    private readonly logger = new Logger(OrdersRelayController.name);

    constructor(
        private readonly ordersRelayService: OrdersRelayService,
        @Inject('ORDERS_ASYNC') private readonly ordersClient: ClientProxy,
    ) { }

    onModuleInit() {
        // No bloquea el arranque de la app
        void this.initialSync();
    }

    private async initialSync() {
        this.logger.log('🚀 Iniciando sincronización inicial de órdenes...');
        try {
            await this.syncOrders();
            this.logger.log('✅ Sincronización inicial de órdenes completada.');
        } catch (err: any) {
            this.logger.error(`❌ Sync inicial de órdenes falló: ${err?.message}`);
        }
    }

    private async syncOrders() {
        const fromCache = await this.ordersRelayService.getLastUpdatedAt();
        this.logger.log(`🔄 Sincronizando órdenes desde: ${fromCache ?? 'el origen del tiempo'}`);

        const response = await firstValueFrom(
            this.ordersClient
                .send(
                    { cmd: 'async_orders_start' },
                    { internalToken: process.env.INTERNAL_SECRET, fromCache },
                )
                .pipe(timeout(REQUEST_TIMEOUT_MS)),
        );
        await this.ordersRelayService.syncOrdersBulk(response);
    }
}