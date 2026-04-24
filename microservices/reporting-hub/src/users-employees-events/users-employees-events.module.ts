import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersEmployeesEventsService } from './users-employees-events.service';
import { UsersEmployeesEventsController } from './users-employees-events.controller';
import { UsersEventsListener } from './users-events.listener';
import {
  UserEmployeeCache,
  UserEmployeeCacheSchema,
} from './schemas/user-employee-cache.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserEmployeeCache.name, schema: UserEmployeeCacheSchema },
      // ☝️ GroupCache ya no necesita registro — está embebido
    ]),
    ClientsModule.register([
      {
        name: 'USER_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'users_queue_sync',
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),
  ],
  providers: [UsersEmployeesEventsService, UsersEventsListener],
  controllers: [UsersEmployeesEventsController],
  exports: [UsersEmployeesEventsService, UsersEventsListener],
})
export class UsersEmployeesEventsModule { }