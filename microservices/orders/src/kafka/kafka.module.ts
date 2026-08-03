import { Global, Module } from '@nestjs/common';
//import { KafkaProducerService } from './kafka.producer';
import { KafkaConsumerService } from './kafka.consumer';
import { KafkaProducerService } from './kafka.producer';
import { KafkaListenersOrchestrator } from './kafka-listeners.orchestrator';
import { CompaniesModule } from '../companies/companies.module';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { CustomersEventsModule } from '../customers-events/customers-events.module';
import { SpareAssignmentsModule } from '../spare-assignments/spare-assignments.module'; 
import { ReportingHubModule } from '../reporting-hub/reporting-hub.module';
@Global()
@Module({
    imports: [CompaniesModule, UsersEmployeesEventsModule, UsersEmployeesEventsModule, CustomersEventsModule,
        SpareAssignmentsModule, ReportingHubModule 
    ],
    providers: [KafkaProducerService, KafkaConsumerService, KafkaListenersOrchestrator],
    exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule { }
