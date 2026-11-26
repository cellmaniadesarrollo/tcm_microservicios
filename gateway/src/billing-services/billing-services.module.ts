import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { BillingServicesController } from './billing-services.controller';
import { BillingServicesService } from './billing-services.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'BILLING_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'billing_core_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
    AuthModule,
  ],
  controllers: [BillingServicesController],
  providers: [BillingServicesService, BillingServiceClient],
})
export class BillingServicesModule {}