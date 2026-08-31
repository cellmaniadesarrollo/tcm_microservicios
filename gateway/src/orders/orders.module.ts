import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
import { OrdersGatewayService } from './orders.service';
import { PartRequestsController } from './part-requests/part-requests.controller';
import { PartRequestsGatewayService } from './part-requests/part-requests-gateway.service';
import { OrderServiceClient } from '../common/microservices/order-service-client';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'orders_queue', // Cola dedicada a orders
          queueOptions: { durable: false },
        },
      },
    ]),
    AuthModule
  ],
  controllers: [OrdersController, PartRequestsController],
  providers: [OrdersGatewayService, PartRequestsGatewayService, OrderServiceClient]
})
export class OrdersModule { }
