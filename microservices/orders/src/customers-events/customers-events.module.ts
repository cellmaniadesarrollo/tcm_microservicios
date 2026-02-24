import { Module } from '@nestjs/common';
import { CustomersEventsController } from './customers-events.controller';
import { CustomersEventsService } from './customers-events.service';
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { CustomerCache } from './entities/customer-cache.entity';
import { CustomerContactCache } from './entities/customer-contact-cache.entity';

import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomersEventsListener } from './customers-events.listener';
@Module({
    imports: [TypeOrmModule.forFeature([CustomerCache,CustomerContactCache]),
    ClientsModule.register([
      {
        name: 'CUSTOMER_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'], 
          queue: 'customers_queue_sync',  
          queueOptions: { durable: true },
          persistent:true
        },
      },
    ]),
  ] ,
  controllers: [CustomersEventsController],
  providers: [CustomersEventsService, CustomersEventsListener]
})
export class CustomersEventsModule {}
