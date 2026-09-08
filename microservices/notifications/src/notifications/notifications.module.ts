// src/notifications/notifications.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification, NotificationSchema } from './entities/notification.entity';
import { OrderObservation, OrderObservationSchema } from './entities/order-observation.entity';
import { OrderObservationsService } from './order-observations.service';
import { CallCounter, CallCounterSchema } from './entities/call-history.entity';
import { OrderObservationsController } from './order-observations.controller';
import { NotificationTracking, NotificationTrackingSchema } from './entities/notification-tracking.entity';
import { NotificationTrackingService } from './notification-tracking.service';
import { NotificationTrackingController } from './notification-tracking.controller';
import { CallCounterService } from './call-counter.service'; // 👈 IMPORTAR EL SERVICE

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: OrderObservation.name, schema: OrderObservationSchema },
      { name: NotificationTracking.name, schema: NotificationTrackingSchema },
      { name: CallCounter.name, schema: CallCounterSchema } // 👈 Modelo de MongoDB
    ])
  ],
  controllers: [
    NotificationsController,
    OrderObservationsController,
    NotificationTrackingController
    // ❌ ELIMINAR: CallCounter (NO es un controlador)
  ],
  providers: [
    NotificationsService,
    OrderObservationsService,
    NotificationTrackingService,
    CallCounterService // ✅ AGREGAR AQUÍ
  ],
  exports: [
    NotificationsService,
    OrderObservationsService,
    NotificationTrackingService,
    CallCounterService // ✅ EXPORTAR TAMBIÉN
  ],
})
export class NotificationsModule {}