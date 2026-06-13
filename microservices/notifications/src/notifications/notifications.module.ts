// src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification, NotificationSchema } from './entities/notification.entity';
import { OrderObservation, OrderObservationSchema } from './entities/order-observation.entity';
import { OrderObservationsService } from './order-observations.service';
import { OrderObservationsController } from './order-observations.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: OrderObservation.name, schema: OrderObservationSchema },
    ])
  ],
  controllers: [NotificationsController, OrderObservationsController],
  providers: [NotificationsService, OrderObservationsService],
  exports: [NotificationsService, OrderObservationsService],
})
export class NotificationsModule {}