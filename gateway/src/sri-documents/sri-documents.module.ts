import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { SriDocumentsController } from './sri-documents.controller';
import { SriDocumentsService } from './sri-documents.service';

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
  controllers: [SriDocumentsController],
  providers: [SriDocumentsService, BillingServiceClient],
})
export class SriDocumentsModule {}