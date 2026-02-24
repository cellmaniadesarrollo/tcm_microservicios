import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyUser } from './entities/company-user.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersEventsListener } from './users-events.listener';

@Module({
        imports: [TypeOrmModule.forFeature([CompanyUser]),
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
  controllers: [UsersController],
  providers: [UsersService,UsersEventsListener],
})
export class UsersModule {}
