import { Module } from '@nestjs/common';
import { UsersEmployeesEventsService } from './users-employees-events.service';
import { UsersEmployeesEventsController } from './users-employees-events.controller';
import { GroupCache } from './entities/group_cache.entity';
import { UserEmployeeCache } from './entities/user_employee_cache.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersEventsListener } from './users-events.listener';

@Module({
      imports: [TypeOrmModule.forFeature([GroupCache,UserEmployeeCache]),
      ClientsModule.register([
        {
          name: 'USER_ASYNC',
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBIT_URL||'amqp://rabbitmq:5672'],
            queue: 'users_queue_sync',  
            queueOptions: { durable: true },
            persistent:true 
          }, 
        },
      ]),
    ] ,
  providers: [UsersEmployeesEventsService,UsersEventsListener],
  controllers: [UsersEmployeesEventsController],
   
})
export class UsersEmployeesEventsModule {}
