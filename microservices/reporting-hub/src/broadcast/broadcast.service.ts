// src/broadcast/broadcast.service.ts
import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';

const TOPICS = {
  VALIDATION_CREATED: 'ms.reporting.validation.created',
  VALIDATION_UPDATED: 'ms.reporting.validation.updated',
} as const;

@Injectable()
export class BroadcastService {
  constructor(private readonly kafkaProducer: KafkaProducerService) { }

  async publishValidationCreated(payload: {
    order_id: number;
    daily_sequential: number;
    validation_date_key: string;
  }): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.VALIDATION_CREATED,
      'VALIDATION_CREATED',
      payload,
      payload.order_id.toString(),
    );
  }

  async publishValidationUpdated(payload: {
    validation_id: string;
    order_id: number;
    is_checked: boolean;
    performed_by: {
      id: string;
      username: string;
      first_name: string;
      last_name: string;
    };
    timestamp: string;
  }): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.VALIDATION_UPDATED,
      'VALIDATION_UPDATED',
      payload,
      payload.order_id.toString(),
    );
  }
}