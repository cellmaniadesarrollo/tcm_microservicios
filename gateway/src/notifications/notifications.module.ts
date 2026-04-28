// gateway/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',     // o 'notifications' si usas docker
          port: 3010,            // ← También 3010
        },
      },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}