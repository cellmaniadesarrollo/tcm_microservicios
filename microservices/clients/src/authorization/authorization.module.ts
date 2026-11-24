import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { CustomerAuthorization } from './entities/customer-authorization.entity';
import { CustomerAuthorizationService } from './services/customer-authorization.service';
import { CustomerAuthorizationController } from './controllers/customer-authorization.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
    imports: [
        TypeOrmModule.forFeature([CustomerAuthorization]),
        UsersEmployeesEventsModule,
        ClientsModule.register([
            {
                name: 'NOTIFICATIONS_QUEUE',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
                    queue: 'notifications_dispatcher_queue',
                    queueOptions: { durable: true }, // igual que en el dispatcher
                    persistent: true,
                },
            },
            {
                name: 'REALTIME_AUTH',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
                    queue: 'realtime_authorization_queue',
                    queueOptions: { durable: true }, // debe coincidir con realtime
                    persistent: true,
                },
            },
        ]),
    ],
    providers: [CustomerAuthorizationService],
    controllers: [CustomerAuthorizationController],
    exports: [CustomerAuthorizationService],
})
export class CustomerAuthorizationModule { }