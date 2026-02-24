import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { Branch } from '../branches/entities/branch.entity';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
   imports: [
      ClientsModule.register([
      {
        name: 'COMPANIES_PUBLISHER',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'companies_events',
          queueOptions: { durable: true },
        },
      },
    ]),TypeOrmModule.forFeature([Company,Branch]),BroadcastModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
