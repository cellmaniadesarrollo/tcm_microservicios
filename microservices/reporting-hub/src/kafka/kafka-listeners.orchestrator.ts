import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { UsersEventsListener } from '../users-employees-events/users-events.listener';
// import { CustomersEventsListener } from '../customers-events/customers-events.listener';  
@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly companiesListener: CompaniesEventsListener,
        private readonly usersListener: UsersEventsListener,
        // private readonly customersListener: CustomersEventsListener, 
    ) { }

    async onModuleInit() {
        try { this.companiesListener.registerHandlers(); }
        catch (e) { console.error('❌ Companies handler error :', e); }

        try { this.usersListener.registerHandlers(); }
        catch (e) { console.error('❌ Users handler error: ', e); }

        // try { this.customersListener.registerHandlers(); }
        // catch (e) { console.error('❌ Customers handler error:', e); }

        await this.kafkaConsumer.start();
    }
}