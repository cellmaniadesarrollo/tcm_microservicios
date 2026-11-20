import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomerCache } from './entities/customer-cache.entity';
import { CustomerContactCache } from './entities/customer-contact-cache.entity';
import { BillingDataCache } from './entities/billing-data-cache.entity';
import { CustomersCacheService } from './services/customers-cache.service';
import { BillingCacheService } from './services/billing-cache.service';
import { ClientsSyncService } from './services/clients-sync.service';
import { CustomersEventsListener } from './listeners/customers-events.listener';
import { CustomersEventsService } from './customers-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerCache, CustomerContactCache, BillingDataCache]),
    ClientsModule.register([{
      name: 'CLIENTS_SYNC',
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'customers_queue_sync',
        queueOptions: { durable: true },
        persistent: true,
      },
    }]),
  ],
  providers: [
    CustomersCacheService, BillingCacheService, ClientsSyncService,
    CustomersEventsListener, CustomersEventsService,
  ],
  exports: [CustomersEventsListener, CustomersEventsService, CustomersCacheService, BillingCacheService],
})
export class CustomersEventsModule { }