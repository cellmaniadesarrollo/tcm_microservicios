// src/sync/sync-rabbitmq.controller.ts
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { SyncGateway } from './sync.gateway';

@Controller()
export class SyncRabbitmqController {
    constructor(private readonly syncGateway: SyncGateway) { }

    @EventPattern('order.created')
    async handleOrderCreated(data: any) {
        const companyId = data.company_id || data.companyId;

        if (!companyId) {
            console.warn('[Sync] order.created recibido sin company_id');
            return;
        }

        const companyRoom = `company:${companyId}`;



        // Emitir SOLO a la empresa correspondiente
        this.syncGateway.server.to(companyRoom).emit('order.created', data);
    }

    @EventPattern('order.updated')
    async handleOrderUpdated(data: any) {
        const companyId = data.company_id || data.companyId;

        if (!companyId) {
            console.warn('[Sync] order.updated recibido sin company_id');
            return;
        }

        const companyRoom = `company:${companyId}`;

        this.syncGateway.server.to(companyRoom).emit('order.updated', data);
    }

    // Agrega aquí más eventos según necesites (order.deleted, notification.new, etc.)
}