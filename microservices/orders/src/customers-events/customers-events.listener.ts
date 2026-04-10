import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { CustomersEventsService } from './customers-events.service';

const TOPICS = {
  CLIENT_CREATED: 'ms.client.created',
  CLIENT_UPDATED: 'ms.client.updated',
} as const;

@Injectable()
export class CustomersEventsListener {
  constructor(
    private readonly cacheService: CustomersEventsService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) { }

  /**
   * Se llama desde un orquestador central (como un EventOrchestrator o el AppModule)
   * para asegurar que los handlers se registren antes de que Kafka empiece a consumir.
   */
  registerHandlers() {
    this.kafkaConsumer.registerHandler(
      TOPICS.CLIENT_CREATED,
      (eventType, data) => this.handleClientCreated(eventType, data),
    );

    this.kafkaConsumer.registerHandler(
      TOPICS.CLIENT_UPDATED,
      (eventType, data) => this.handleClientUpdated(eventType, data),
    );

    console.log('📡 Handlers de Customers registrados');
  }

  private async handleClientCreated(eventType: string, data: any) {
    console.log(`🟢 [${eventType}] Procesando cliente creado: ${data?.id}`);
    try {
      await this.cacheService.syncCustomer(data);
    } catch (error) {
      console.error(`❌ Error sincronizando cliente creado: ${error.message}`);
    }
  }

  private async handleClientUpdated(eventType: string, data: any) {
    console.log(`🔵 [${eventType}] Procesando cliente actualizado: ${data?.id}`);
    try {
      await this.cacheService.syncCustomer(data);
    } catch (error) {
      console.error(`❌ Error sincronizando cliente actualizado: ${error.message}`);
    }
  }
}