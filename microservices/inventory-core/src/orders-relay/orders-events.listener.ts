import { Injectable, Logger } from '@nestjs/common';
// Ajusta la ruta a donde esté el KafkaConsumerService en este MS
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { OrdersRelayService } from './orders-relay.service';

const TOPICS = {
    ORDER_CREATED: 'ms.order.created',
    ORDER_UPDATED: 'ms.order.updated',
} as const;

@Injectable()
export class OrdersEventsListener {
    private readonly logger = new Logger(OrdersEventsListener.name);

    constructor(
        private readonly ordersRelayService: OrdersRelayService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    // Llamar desde el orquestador / bootstrap del MS
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
        this.logger.log(`🧾 [${eventType}] Orden creada: ${data?.id}`);
        await this.ordersRelayService.syncOrder(data);
    }

    private async handleOrderUpdated(data: {
        order_id: number;
        changed_scope: string;
        payload: any;
        updatedAt: string;
    }) {
        const { order_id, changed_scope, payload, updatedAt } = data;
        this.logger.debug(`🧾 [order.updated] scope: ${changed_scope} | order: ${order_id}`);
        await this.ordersRelayService.applyUpdate(order_id, changed_scope, payload, updatedAt);
    }
}