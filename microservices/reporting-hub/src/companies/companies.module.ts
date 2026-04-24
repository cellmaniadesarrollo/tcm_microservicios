import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompaniesEventsListener } from './companies-events.listener';
import { CompanyReplica, CompanyReplicaSchema } from './schemas/company-replica.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanyReplica.name, schema: CompanyReplicaSchema },
      // ☝️ ya no necesitas registrar BranchReplica — está embebida
    ]),
    ClientsModule.register([
      {
        name: 'COMPANIES_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'companies_queue_sync',
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesEventsListener],
  exports: [CompaniesEventsListener],
})
export class CompaniesModule { }
