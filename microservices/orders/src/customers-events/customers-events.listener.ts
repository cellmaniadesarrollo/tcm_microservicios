import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { CustomersEventsService } from './customers-events.service';

const TOPICS = {
  CLIENT_CREATED: 'ms.client.created',
  CLIENT_UPDATED: 'ms.client.updated',
} as const;

@Injectable()
export class CustomersEventsListener implements OnModuleInit {
  constructor(
    private readonly cacheService: CustomersEventsService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) { }

  async onModuleInit() {
    // 1. Primero registrar todos los handlers
    this.kafkaConsumer.registerHandler(
      TOPICS.CLIENT_CREATED,
      (eventType, data) => this.handleClientCreated(eventType, data),
    );

    this.kafkaConsumer.registerHandler(
      TOPICS.CLIENT_UPDATED,
      (eventType, data) => this.handleClientUpdated(eventType, data),
    );

    // 2. Recién ahora arrancar la suscripción con los handlers ya listos
    await this.kafkaConsumer.start();

    console.log('📡 CustomersEventsListener listo en Kafka');
  }

  private async handleClientCreated(eventType: string, data: any) {
    console.log(`🟢 [${eventType}] Procesando cliente creado: ${data?.id}`);
    await this.cacheService.syncCustomer(data);
  }

  private async handleClientUpdated(eventType: string, data: any) {
    console.log(`🔵 [${eventType}] Procesando cliente actualizado: ${data?.id}`);
    await this.cacheService.syncCustomer(data);
  }
}