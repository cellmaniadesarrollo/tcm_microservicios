import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompaniesEventsListener } from './companies-events.listener';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyReplica } from './entities/company-replica.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyReplica,
    ]),
    ClientsModule.register([
      {
        name: 'COMPANIES_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'companies_queue_sync',
          queueOptions: { durable: true },
          persistent: true
        },
      },
    ]),
    KafkaModule
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesEventsListener],
  exports: [CompaniesEventsListener]
})
export class CompaniesModule { }
