// microservices/orders/src/inventory-items/inventory-items.controller.ts
import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InventoryItemsService } from './inventory-items.service';

@Controller()
export class InventoryItemsController implements OnModuleInit {

    constructor(
        private readonly inventoryItemsService: InventoryItemsService,
        @Inject('INVENTORY_ASYNC') private readonly inventoryClient: ClientProxy,
    ) { }

    async onModuleInit() {
        try {
            const fromCache = await this.inventoryItemsService.getLastUpdatedAt();
            console.log(`🔄 Sincronizando ítems de inventario desde: ${fromCache ?? 'el origen del tiempo'}`);

            const response = await firstValueFrom(
                this.inventoryClient.send(
                    { cmd: 'async_inventory_items_start' },
                    {
                        internalToken: process.env.INTERNAL_SECRET,
                        fromCache,
                    },
                ),
            );

            await this.inventoryItemsService.syncBulk(response);
        } catch (err: any) {
            console.error('❌ Error en sync inicial de ítems de inventario:', err.message);
        }
    }
}