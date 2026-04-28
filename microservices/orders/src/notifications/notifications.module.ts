import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'REALTIME_SERVICE',           // Nombre del token de inyección
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RABBIT_URL || 'amqp://guest:guest@localhost:5672'],
                    queue: 'realtime_orders_queue',   // ← Debe coincidir con la queue que pusiste en main.ts del realtime
                    queueOptions: {
                        durable: true,
                    },
                },
            },
        ]),
    ],
    providers: [NotificationsService],
    exports: [NotificationsService],   //
})
export class NotificationsModule { }
