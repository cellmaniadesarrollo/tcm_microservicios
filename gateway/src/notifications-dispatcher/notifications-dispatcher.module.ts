import { Module } from '@nestjs/common';
import { NotificationsDispatcherService } from './notifications-dispatcher.service';
import { NotificationsDispatcherController } from './notifications-dispatcher.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_DISPATCHER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'notifications_dispatcher_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
    AuthModule
  ],
  controllers: [NotificationsDispatcherController],
  providers: [NotificationsDispatcherService],
})
export class NotificationsDispatcherModule { }
