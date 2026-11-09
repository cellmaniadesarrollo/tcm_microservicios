import { Module } from '@nestjs/common';
import { OrdersRelayService } from './orders-relay.service';
import { OrdersRelayController } from './orders-relay.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderReplica } from './entities/order-replica.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersEventsListener } from './orders-events.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderReplica]),
    ClientsModule.register([
      {
        name: 'ORDERS_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'orders_queue_sync',
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),
  ],
  controllers: [OrdersRelayController],
  providers: [OrdersRelayService, OrdersEventsListener],
  exports: [OrdersRelayService, OrdersEventsListener, TypeOrmModule],
})
export class OrdersRelayModule { }
