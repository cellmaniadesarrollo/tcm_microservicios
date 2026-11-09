import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CompanyReplica } from './entities/company-replica.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompaniesEventsListener } from './companies-events.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyReplica]),
    ClientsModule.register([
      {
        name: 'COMPANIES_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL as string],
          queue: 'companies_async_queue', // COPIA el nombre real de clients
          queueOptions: { durable: false },
        },
      },
    ]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesEventsListener],
  exports: [CompaniesService, CompaniesEventsListener],
})
export class CompaniesModule {}