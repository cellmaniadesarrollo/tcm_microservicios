import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { OrdersRelayService } from './orders-relay.service';

const TOPICS = { ORDER_UPDATED: 'ms.order.updated' } as const;

@Injectable()
export class OrdersEventsListener {
  constructor(
    private readonly service: OrdersRelayService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) {}

  registerHandlers() {
    this.kafkaConsumer.registerHandler(TOPICS.ORDER_UPDATED, (_eventType, data) =>
      this.service.handleOrderUpdated(data),
    );
  }
}