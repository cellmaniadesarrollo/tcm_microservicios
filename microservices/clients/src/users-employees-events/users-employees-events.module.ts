import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UserEmployeeCache } from './entities/user_employee_cache.entity';
import { UsersEmployeesEventsService } from './services/users-employees-events.service';
import { UsersEmployeesEventsController } from './controllers/users-employees-events.controller';
@Module({
    imports: [
        TypeOrmModule.forFeature([UserEmployeeCache]),
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
    providers: [UsersEmployeesEventsService],
    controllers: [UsersEmployeesEventsController],
    exports: [UsersEmployeesEventsService],
})
export class UsersEmployeesEventsModule { } 