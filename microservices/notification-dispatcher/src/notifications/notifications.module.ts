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
import { CustomerCache } from '../customers-events/entities/customer-cache.entity';
import { MailModule } from '../mail/mail.module';
import { EmailNotificationsService } from './email-notifications.service';
import { AuthorizationMailController } from './authorization-mail.controller';
import { AuthorizationMailService } from './authorization-mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationLog,
      NotificationSchedule,
      OrderReplica,
      CustomerContactCache,
      CustomerCache
    ]),
    ScheduleModule.forRoot(),
    forwardRef(() => WhatsappModule),
    forwardRef(() => OrdersRelayModule),   // ← AGREGAR ESTO
    MailModule
  ],
  controllers: [NotificationsConsumer, AuthorizationMailController],
  providers: [
    NotificationsService,
    NotificationsScheduler,
    EmailNotificationsService,
    AuthorizationMailService
  ],
  exports: [NotificationsService],
})
export class NotificationsModule { }