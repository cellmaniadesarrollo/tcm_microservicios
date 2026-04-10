import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';

const TOPICS = {
  CLIENT_CREATED: 'ms.client.created',
  CLIENT_UPDATED: 'ms.client.updated',
  CLIENT_BILLING_CREATED: 'ms.client.billing.created',
  CLIENT_BILLING_UPDATED: 'ms.client.billing.updated',
} as const;

@Injectable()
export class BroadcastService {
  constructor(private readonly kafkaProducer: KafkaProducerService) { }

  async publishClientCreated(customer: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.CLIENT_CREATED,
      'CLIENT_CREATED',
      customer,
      customer.id?.toString(),
    );
  }

  async publishClientUpdated(customer: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.CLIENT_UPDATED,
      'CLIENT_UPDATED',
      customer,
      customer.id?.toString(),
    );
  }

  // ==================== MÉTODOS DE BILLING ====================

  async publishClientBillingCreated(billing: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.CLIENT_BILLING_CREATED,
      'CLIENT_BILLING_CREATED',
      billing,
      billing.id?.toString(),
    );
  }

  async publishClientBillingUpdated(billing: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.CLIENT_BILLING_UPDATED,
      'CLIENT_BILLING_UPDATED',
      billing,
      billing.id?.toString(),
    );
  }
}