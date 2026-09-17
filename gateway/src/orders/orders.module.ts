import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
import { OrdersGatewayService } from './orders.service';
import { PartRequestsController } from './part-requests/part-requests.controller';
import { PartRequestsGatewayService } from './part-requests/part-requests-gateway.service';
import { OrderServiceClient } from '../common/microservices/order-service-client';
import { DiscountsController } from './discounts/discounts.controller';
import { DiscountsGatewayService } from './discounts/discounts-gateway.service';
import { InvoicesController } from './invoices/invoices.controller';
import { InvoicesGatewayService } from './invoices/invoices-gateway.service';

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
  controllers: [OrdersController, PartRequestsController, InvoicesController],
  providers: [OrdersGatewayService, PartRequestsGatewayService, OrderServiceClient, InvoicesGatewayService]
})
export class OrdersModule { }
