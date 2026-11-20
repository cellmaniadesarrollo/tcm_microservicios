import { Global, Module } from '@nestjs/common';
//import { KafkaProducerService } from './kafka.producer';
import { KafkaConsumerService } from './kafka.consumer';
import { KafkaListenersOrchestrator } from './kafka-listeners.orchestrator';
import { CompaniesModule } from '../companies/companies.module';
import { CustomersEventsModule } from '../customers-events/customers-events.module';
import { OrdersRelayModule } from '../orders-relay/orders-relay.module';
@Global()
@Module({
    imports: [
        CompaniesModule,
        CustomersEventsModule,
        OrdersRelayModule

    ],
    providers: [KafkaConsumerService, KafkaListenersOrchestrator],
    exports: [KafkaConsumerService],
})
export class KafkaModule { }
