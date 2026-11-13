import { Global, Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { KafkaProducerService } from './kafka.producer';
import { KafkaListenersOrchestrator } from './kafka-listeners.orchestrator';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { CompaniesModule } from '../companies/companies.module';
import { ProductsReplicaModule } from '../products-replica/products-replica.module';
import { LotsReplicaModule } from '../lots-replica/lots-replica.module';
import { ClientsReplicaModule } from '../clients-replica/clients-replica.module';

@Global()
@Module({
    imports: [
        CompaniesModule,
        UsersEmployeesEventsModule,
        ProductsReplicaModule,
        LotsReplicaModule,
        ClientsReplicaModule

    ],
    providers: [KafkaProducerService, KafkaConsumerService, KafkaListenersOrchestrator],
    exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule { }