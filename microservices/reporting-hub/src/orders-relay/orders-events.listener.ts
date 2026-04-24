// src/orders/orders-events.listener.ts
import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
//import { OrdersService } from './orders.service';

const TOPICS = {
    ORDER_CREATED: 'ms.order.created',
    ORDER_UPDATED: 'ms.order.updated',
} as const;

@Injectable()
export class OrdersEventsListener {
    constructor(
        //   private readonly ordersService: OrdersService,
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
            (eventType, data) => this.handleOrderUpdated(eventType, data),
        );
    }

    private async handleOrderCreated(eventType: string, data: any) {
        console.log(`🧾 [${eventType}] Orden creada: ${data?.id}`);

        // Aquí defines tu lógica (ej: persistir, cachear, relay, etc.)
        // await this.ordersService.createOrSync(data);
    }

    private async handleOrderUpdated(eventType: string, data: any) {
        console.log(`🧾 [${eventType}] Orden actualizada: ${data?.id}`);

        // await this.ordersService.createOrSync(data);
    }
}