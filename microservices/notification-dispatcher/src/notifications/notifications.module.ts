// notifications.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationLog } from './entities/notification-log.entity';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { CustomerContactCache } from '../customers-events/entities/customer-contact-cache.entity';

import { NotificationsService } from './notifications.service';
import { NotificationsConsumer } from './notifications.consumer';
import { NotificationsScheduler } from './notifications.scheduler';

import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { OrdersRelayModule } from '../orders-relay/orders-relay.module'; // ← Agregar
import { OrderReplica } from '../orders-relay/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationLog,
      NotificationSchedule,
      OrderReplica,
      CustomerContactCache,
    ]),
    ScheduleModule.forRoot(),
    forwardRef(() => WhatsappModule),
    forwardRef(() => OrdersRelayModule),   // ← AGREGAR ESTO
  ],
  controllers: [NotificationsConsumer],
  providers: [
    NotificationsService,
    NotificationsScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule { }