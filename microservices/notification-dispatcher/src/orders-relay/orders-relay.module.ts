// src/orders-relay/orders-relay.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { OrdersRelayController } from './orders-relay.controller';
import { OrdersRelayService } from './orders-relay.service';
import { OrdersEventsListener } from './orders-events.listener';

import { OrderReplica, OrderStatus, OrderType } from './entities';
import { NotificationsModule } from '../notifications/notifications.module'; // ← Agrega esta importación

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderReplica, OrderStatus, OrderType]),

    forwardRef(() => NotificationsModule),   // ← AGREGAR ESTO

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
  exports: [
    OrdersEventsListener,
    TypeOrmModule,
  ],
})
export class OrdersRelayModule { }