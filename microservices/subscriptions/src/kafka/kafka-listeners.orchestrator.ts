import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { UsersEventsListener } from '../users-employees-events/users-events.listener';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly companiesListener: CompaniesEventsListener,
        private readonly usersListener: UsersEventsListener,
    ) { }

    async onModuleInit() {
        // 1. Todos registran sus handlers
        this.companiesListener.registerHandlers();
        this.usersListener.registerHandlers();

        // 2. Un solo start() con todos los topics listos
        await this.kafkaConsumer.start();

        console.log('✅ Kafka — todos los listeners activos');
    }
}