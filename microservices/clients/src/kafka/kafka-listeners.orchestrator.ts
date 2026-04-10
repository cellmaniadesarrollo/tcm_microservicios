import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly companiesListener: CompaniesEventsListener,
    ) { }

    async onModuleInit() {
        // 1. Todos registran sus handlers (preparar los temas)
        this.companiesListener.registerHandlers();

        // 2. Un solo start() con todos los topics listos y suscritos
        await this.kafkaConsumer.start();

        console.log('✅ Kafka — todos los listeners activos (Companies, Users, Customers)');
    }
}