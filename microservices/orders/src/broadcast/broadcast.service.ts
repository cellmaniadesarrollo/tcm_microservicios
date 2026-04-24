// src/broadcast/broadcast.service.ts
import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';

const TOPICS = {
  ORDER_CREATED: 'ms.order.created',
  ORDER_UPDATED: 'ms.order.updated',
} as const;

@Injectable()
export class BroadcastService {
  constructor(private readonly kafkaProducer: KafkaProducerService) { }

  async publishOrderCreated(order: any): Promise<void> {
    console.log(order)
    await this.kafkaProducer.emit(
      TOPICS.ORDER_CREATED,
      'ORDER_CREATED',
      order,
      order.id?.toString(),
    );
  }

  async publishOrderUpdated(order: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.ORDER_UPDATED,
      'ORDER_UPDATED',
      order,
      order.id?.toString(),
    );
  }
}