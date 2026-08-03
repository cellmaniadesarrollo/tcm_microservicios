// microservices/notifications/src/reminders/reminder.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ReminderService } from './reminder.service';
import { Notification, NotificationSchema } from '../notifications/entities/notification.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}