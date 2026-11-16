import { Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../outbox/outbox.module';
import { SpareCancellationRequest } from './entities/spare-cancellation-request.entity';
import { SpareCancellationsEventsListener } from './listeners/spare-cancellations-events.listener';
import { SpareCancellationsService } from './services/spare-cancellations.service';
import { SpareCancellationsController } from './controllers/spare-cancellations.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
    imports: [TypeOrmModule.forFeature([SpareCancellationRequest]), OutboxModule,
        AuditLogModule],
    controllers: [SpareCancellationsController],
    providers: [
        SpareCancellationsService,
        SpareCancellationsEventsListener,
        {
            // Cliente RMQ hacia órdenes (reconciliación de solicitudes de cancelación).
            provide: 'ORDERS_CANCELLATIONS_SYNC',
            useFactory: () =>
                ClientProxyFactory.create({
                    transport: Transport.RMQ,
                    options: {
                        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
                        queue: 'orders_queue_sync',
                        queueOptions: { durable: true },
                    },
                }),
        },
    ],
    exports: [SpareCancellationsEventsListener, SpareCancellationsService],
})
export class SpareCancellationsModule { }