import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { CustomersEventsService } from './customers-events.service';

// Deben coincidir con TOPICS de clients/src/broadcast/broadcast.service.ts
const TOPICS = {
  CUSTOMER_CREATED: 'ms.client.created',
  CUSTOMER_UPDATED: 'ms.client.updated',
} as const;

@Injectable()
export class CustomersEventsListener {
  constructor(
    private readonly service: CustomersEventsService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) {}

  registerHandlers() {
    this.kafkaConsumer.registerHandler(TOPICS.CUSTOMER_CREATED, (eventType, data) =>
      this.service.syncCustomer(data, true),
    );
    this.kafkaConsumer.registerHandler(TOPICS.CUSTOMER_UPDATED, (eventType, data) =>
      this.service.syncCustomer(data, false),
    );
  }
}