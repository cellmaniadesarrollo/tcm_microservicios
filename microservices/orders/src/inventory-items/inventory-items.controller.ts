// microservices/orders/src/inventory-items/inventory-items.controller.ts
import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { InventoryItemsService } from './inventory-items.service';

@Controller()
export class InventoryItemsController implements OnModuleInit {

    constructor(
        private readonly inventoryItemsService: InventoryItemsService,
        @Inject('INVENTORY_ASYNC') private readonly inventoryClient: ClientProxy,
    ) { }

    /** No bloquea el arranque: la sync corre en segundo plano. */
    onModuleInit() {
        void this.syncOnStart();
    }

    private async syncOnStart() {
        try {
            const fromCache = await this.inventoryItemsService.getLastUpdatedAt();
            console.log(`🔄 Sincronizando ítems de inventario desde: ${fromCache ?? 'el origen del tiempo'}`);

            const response = await firstValueFrom(
                this.inventoryClient
                    .send(
                        { cmd: 'async_inventory_items_start' },
                        {
                            internalToken: process.env.INTERNAL_SECRET,
                            fromCache,
                        },
                    )
                    .pipe(timeout(30000)),
            );

            await this.inventoryItemsService.syncBulk(response);
        } catch (err: any) {
            console.warn('⚠️ Sync inicial de ítems de inventario omitida:', err?.message ?? err);
        }
    }
}