import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
@Module({
  imports: [
     ClientsModule.register([
        {
          name: 'CUSTOMERS_SERVICE',
          transport: Transport.RMQ,
          options: {
            urls: ['amqp://rabbitmq:5672'],
            queue: 'customers_queue',
            queueOptions: { durable: false },
          },
        },
      ]), AuthModule
    ],
  controllers: [CustomersController],
  providers: [CustomersService]
})
export class CustomersModule {}
