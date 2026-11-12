import { Global, Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { KafkaProducerService } from './kafka.producer';
import { KafkaListenersOrchestrator } from './kafka-listeners.orchestrator';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { CompaniesModule } from '../companies/companies.module';
import { ProductsReplicaModule } from '../products-replica/products-replica.module';

@Global()
@Module({
    imports: [
        CompaniesModule,
        UsersEmployeesEventsModule,
        ProductsReplicaModule

    ],
    providers: [KafkaProducerService, KafkaConsumerService, KafkaListenersOrchestrator],
    exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule { }