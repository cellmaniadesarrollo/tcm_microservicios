import { Global, Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { UsersEventsListener } from '../users-employees-events/users-events.listener';
import { KafkaListenersOrchestrator } from './kafka-listeners.orchestrator';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { CompaniesModule } from '../companies/companies.module';

@Global()
@Module({
    providers: [KafkaConsumerService,
    ],
    exports: [KafkaConsumerService],
})
export class KafkaModule { }