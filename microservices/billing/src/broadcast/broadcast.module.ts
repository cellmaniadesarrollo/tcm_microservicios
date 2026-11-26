import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BroadcastService } from './service/broadcast.service';
import { REALTIME_CLIENT } from './broadcast.constants';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: REALTIME_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
          queue: 'realtime_orders_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [BroadcastService],
  exports: [BroadcastService],
})
export class BroadcastModule {}