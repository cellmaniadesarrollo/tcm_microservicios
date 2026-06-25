import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { UsersEventsListener } from '../users-employees-events/users-events.listener';
import { CustomersEventsListener } from '../customers-events/customers-events.listener'; // <-- Asegúrate de que el path sea correcto
import { SpareAssignment } from '../spare-assignments/entities/spare-assignment.entity';
import { SpareAssignmentsEventsListener } from '../spare-assignments/spare-assignments-events.listener';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly companiesListener: CompaniesEventsListener,
        private readonly usersListener: UsersEventsListener,
        private readonly customersListener: CustomersEventsListener, // <-- 1. Inyectamos el nuevo listener
        private readonly spareAssignmentsListener: SpareAssignmentsEventsListener,
    ) { }

    async onModuleInit() {
        try { this.companiesListener.registerHandlers(); }
        catch (e) { console.error('❌ Companies handler error :', e); }

        try { this.usersListener.registerHandlers(); }
        catch (e) { console.error('❌ Users handler error: ', e); }

        try { this.customersListener.registerHandlers(); }
        catch (e) { console.error('❌ Customers handler error:', e); }

        try { this.spareAssignmentsListener.registerHandlers(); }
        catch (e) { console.error('❌ Customers handler error:', e); }

        await this.kafkaConsumer.start();
    }
}