// src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification, NotificationSchema } from './entities/notification.entity';
import { OrderObservation, OrderObservationSchema } from './entities/order-observation.entity';
import { OrderObservationsService } from './order-observations.service';
import { OrderObservationsController } from './order-observations.controller';
// ✅ Importar lo nuevo de NotificationTracking
import { NotificationTracking, NotificationTrackingSchema } from './entities/notification-tracking.entity';
import { NotificationTrackingService } from './notification-tracking.service';
import { NotificationTrackingController } from './notification-tracking.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: OrderObservation.name, schema: OrderObservationSchema },
      { name: NotificationTracking.name, schema: NotificationTrackingSchema },
    ])
  ],
  controllers: [
    NotificationsController, 
    OrderObservationsController,
    NotificationTrackingController
  ],
  providers: [
    NotificationsService, 
    OrderObservationsService,
    NotificationTrackingService
  ],
  exports: [
    NotificationsService, 
    OrderObservationsService,
    NotificationTrackingService
  ],
})
export class NotificationsModule {}