// src/orders/orders-events.listener.ts
import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { OrdersRelayService } from './orders-relay.service';
//import { OrdersService } from './orders.service';

const TOPICS = {
    ORDER_CREATED: 'ms.order.created',
    ORDER_UPDATED: 'ms.order.updated',
} as const;

@Injectable()
export class OrdersEventsListener {
    constructor(
        private readonly ordersRelayService: OrdersRelayService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    // Lo llamas desde tu orquestador
    registerHandlers() {
        this.kafkaConsumer.registerHandler(
            TOPICS.ORDER_CREATED,
            (eventType, data) => this.handleOrderCreated(eventType, data),
        );

        this.kafkaConsumer.registerHandler(
            TOPICS.ORDER_UPDATED,
            (_, data) => this.handleOrderUpdated(data),
        );
    }

    private async handleOrderCreated(eventType: string, data: any) {
        console.log(`🧾 [${eventType}] Orden creada: ${data?.id}`);
        console.log(data)
        // Aquí defines tu lógica (ej: persistir, cachear, relay, etc.)
        await this.ordersRelayService.syncOrder(data);
    }

    private async handleOrderUpdated(data: {
        order_id: number;
        changed_scope: string;
        payload: any;
        updatedAt: string;
    }) {
        const { order_id, changed_scope, payload, updatedAt } = data;
        console.log(`🧾 [order.updated] scope: ${changed_scope} | order: ${order_id}`);
        await this.ordersRelayService.applyUpdate(order_id, changed_scope, payload, updatedAt);
    }
}