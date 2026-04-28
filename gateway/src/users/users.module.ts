import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '../common/jwt/jwt.module';  
import { UsersService } from './users.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
   imports: [
   ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'users_queue',
          queueOptions: { durable: false }, 
        },
      },
    ]),
    JwtModule, SubscriptionsModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
