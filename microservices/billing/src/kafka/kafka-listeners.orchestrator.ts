// src/kafka/kafka-listeners.orchestrator.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { UsersEventsListener } from '../users-employees-events/users-events.listener';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { ProductsEventsListener } from '../products-replica/products-events.listener';
import { LotsEventsListener } from '../lots-replica/listeners/lots-events.listener';
import { ClientsEventsListener } from '../clients-replica/listeners/clients-events.listener';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly usersListener: UsersEventsListener,
        private readonly companiesListener: CompaniesEventsListener,
        private readonly productsListener: ProductsEventsListener,
        private readonly lotsListener: LotsEventsListener,
        private readonly clientsListener: ClientsEventsListener,
    ) { }

    async onModuleInit() {
        await this.kafkaConsumer.connect();

        try { this.usersListener.registerHandlers(); }
        catch (e) { console.error('❌ Users handler error:', e); }

        try { this.companiesListener.registerHandlers(); }
        catch (e) { console.error('❌ Companies handler error:', e); }

        try { this.productsListener.registerHandlers(); }
        catch (e) { console.error('❌ Products handler error:', e); }

        try { this.lotsListener.registerHandlers(); }
        catch (e) { console.error('❌ Lots handler error:', e); }

        try { this.clientsListener.registerHandlers(); }
        catch (e) { console.error('❌ Clients handler error:', e); }
    }
}