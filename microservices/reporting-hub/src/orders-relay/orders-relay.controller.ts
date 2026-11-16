import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { OrdersRelayService } from './orders-relay.service';
import { OrdersReconcileService } from './orders-reconcile.service';

@Controller('orders-relay')
export class OrdersRelayController implements OnModuleInit {
    constructor(
        private readonly ordersRelayService: OrdersRelayService,
        private readonly reconcileService: OrdersReconcileService,
        @Inject('ORDERS_ASYNC') private readonly ordersClient: ClientProxy,
    ) { }

    async onModuleInit() {
        console.log('🚀 Iniciando procesos de sincronización...');

        try {
            // 1. Catálogos primero (los IDs de referencia deben existir)
            await this.syncNormalizations();

            // 2. Reconciliación de órdenes, sin await para no bloquear el arranque
            void this.reconcileService.run('startup');

            console.log('✅ Catálogos sincronizados; reconciliación de órdenes en segundo plano.');
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

        await this.ordersRelayService.syncNormalizations(response);
    }
}