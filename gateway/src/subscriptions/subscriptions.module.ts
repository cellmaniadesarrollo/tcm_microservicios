import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
    imports: [
      ClientsModule.register([
        {
          name: 'SUBSCRIPTION_SERVICE',
          transport: Transport.RMQ,
          options: {
            urls: ['amqp://rabbitmq:5672'],
            queue: 'subscriptions_queue', // Cola dedicada a orders
            queueOptions: { durable: false },
          },
        },
      ]) 
    ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports:[SubscriptionsService]
})
export class SubscriptionsModule {}
