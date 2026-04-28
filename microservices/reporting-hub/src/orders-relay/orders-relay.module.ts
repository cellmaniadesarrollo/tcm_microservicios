import { Module } from '@nestjs/common';
import { OrdersRelayController } from './orders-relay.controller';
import { OrdersRelayService } from './orders-relay.service';
import { OrdersEventsListener } from './orders-events.listener';
import { OrderReplica, OrderReplicaSchema } from './schemas/order-replica.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderStatus, OrderStatusSchema } from './schemas/order-status.schema';
import { OrderType, OrderTypeSchema } from './schemas/order-type.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderReplica.name, schema: OrderReplicaSchema },
      { name: OrderStatus.name, schema: OrderStatusSchema },
      { name: OrderType.name, schema: OrderTypeSchema },
    ]),
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
  exports: [OrdersEventsListener, MongooseModule.forFeature([
    { name: OrderStatus.name, schema: OrderStatusSchema },
    { name: OrderType.name, schema: OrderTypeSchema },
  ]),]
})
export class OrdersRelayModule { }
