import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { UsersEventsListener } from '../users-employees-events/users-events.listener';
import { CustomersEventsListener } from '../customers-events/customers-events.listener'; // <-- Asegúrate de que el path sea correcto

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly companiesListener: CompaniesEventsListener,
        private readonly usersListener: UsersEventsListener,
        private readonly customersListener: CustomersEventsListener, // <-- 1. Inyectamos el nuevo listener
    ) { }

    async onModuleInit() {
        // 1. Todos registran sus handlers (preparar los temas)
        this.companiesListener.registerHandlers();
        this.usersListener.registerHandlers();
        this.customersListener.registerHandlers(); // <-- 2. Registramos los de clientes

        // 2. Un solo start() con todos los topics listos y suscritos
        await this.kafkaConsumer.start();

        console.log('✅ Kafka — todos los listeners activos (Companies, Users, Customers)');
    }
}