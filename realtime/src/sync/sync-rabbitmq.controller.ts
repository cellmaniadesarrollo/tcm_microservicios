// src/sync/sync-rabbitmq.controller.ts
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { SyncGateway } from './sync.gateway'; // ← inyectamos tu gateway

@Controller()
export class SyncRabbitmqController {
    constructor(private readonly syncGateway: SyncGateway) { }

    @EventPattern('order.created')           // ← nombre del evento que enviará el MS Orders
    async handleOrderCreated(data: any) {
        console.log('📨 Orden recibida de RabbitMQ:', data);
        // Lo retransmitimos a TODOS los clientes conectados
        this.syncGateway.server.emit('order.created', data);
    }

    @EventPattern('order.updated')
    async handleOrderUpdated(data: any) {
        this.syncGateway.server.emit('order.updated', data);
    }

    // agrega tantos @EventPattern como necesites
}