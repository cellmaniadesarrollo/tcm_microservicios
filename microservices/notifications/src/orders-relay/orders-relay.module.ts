import { Module } from '@nestjs/common';
import { OrdersRelayController } from './orders-relay.controller';
import { OrdersRelayService } from './orders-relay.service';
import { OrdersEventsListener } from './orders-events.listener';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Notification, NotificationSchema } from '../notifications/entities/notification.entity';
import { Audit, AuditSchema } from '../audit/entities/audit.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Audit.name, schema: AuditSchema },
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
  exports: [OrdersEventsListener]
})
export class OrdersRelayModule { }
