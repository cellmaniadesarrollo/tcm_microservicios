// microservices/orders/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'REALTIME_SERVICE',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RABBIT_URL || 'amqp://guest:guest@ms-notifications-rabbitmq:5672'],
                    queue: 'realtime_orders_queue',
                    queueOptions: { durable: true },
                },
            },
            // {
            //     name: 'NOTIFICATIONS_SAVE_CLIENT',  // ← AGREGAR ESTE CLIENTE
            //     transport: Transport.RMQ,
            //     options: {
            //         urls: [process.env.RABBIT_URL || 'amqp://guest:guest@ms-notifications-rabbitmq:5672'],
            //         queue: 'notifications_queue',  // ← La cola que escucha Notifications
            //         queueOptions: { durable: true },
            //     },
            // },
        ]),
    ],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule {}