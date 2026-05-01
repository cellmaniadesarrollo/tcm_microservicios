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
        console.log('🚀 Iniciando procesos de sincronización...');

        try {
            // 1. Sincronizar Normalizaciones (Maestros/Catálogos)
            // Es recomendable hacerlo primero para tener los IDs de referencia listos.
            await this.syncNormalizations();

            // 2. Sincronizar Órdenes
            await this.syncOrders();

            console.log('✅ Sincronización inicial completada con éxito.');
        } catch (err: any) {
            console.error('❌ Error crítico en el ciclo de inicio:', err.message);
        }
    }

    private async syncNormalizations() {
        console.log('🔄 Sincronizando catálogos (normalizations)...');

        const response = await firstValueFrom(
            this.ordersClient.send(
                { cmd: 'async_normalizations_start' },
                { internalToken: process.env.INTERNAL_SECRET },
            ),
        );
        console.log('normalizaciones', response)
        await this.ordersRelayService.syncNormalizations(response);
    }

    private async syncOrders() {
        const fromCache = await this.ordersRelayService.getLastUpdatedAt();
        console.log(`🔄 Sincronizando órdenes desde: ${fromCache ?? 'el origen del tiempo'}`);

        const response = await firstValueFrom(
            this.ordersClient.send(
                { cmd: 'async_orders_start' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    fromCache,
                },
            ),
        );
        console.log(response)
        await this.ordersRelayService.syncOrdersBulk(response);
    }


}