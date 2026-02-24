import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
       ClientsModule.register([
          {
            name: 'COMPANIES_SERVICE',
            transport: Transport.RMQ,
            options: {
              urls: ['amqp://rabbitmq:5672'],
              queue: 'companies_queue',
              queueOptions: { durable: false },
            },
          },
        ]), 
      ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
