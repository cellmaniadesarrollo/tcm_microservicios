import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { CustomersEventsListener } from '../customers-events/customers-events.listener';
import { OrdersEventsListener } from '../orders-relay/orders-events.listener';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly companiesListener: CompaniesEventsListener,
    private readonly customersListener: CustomersEventsListener,
    private readonly ordersListener: OrdersEventsListener,
  ) {}

  async onModuleInit() {
    console.log('🚀 Orquestador iniciando...');
    this.companiesListener.registerHandlers();
    this.customersListener.registerHandlers();
    this.ordersListener.registerHandlers();

    await this.kafkaConsumer.start();
    console.log('✅ Kafka: listeners activos (Companies, Customers, Orders)');
  }
}