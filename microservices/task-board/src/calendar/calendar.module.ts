// task-board/src/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices'; // 🔥 IMPORTAR
import { CalendarController } from './calendar.controller';
import { CalendarTcpController } from './calendar-tcp.controller';
import { CalendarService } from './calendar.service';
import { GoogleCalendarService } from './google-calendar.service';
import { EmployeeTask } from './entities/employee-task.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { CalendarRemindersService } from './calendar-reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeTask]),
    ConfigModule,
    PushNotificationsModule,
    // 🔥 AGREGAR cliente de users
    ClientsModule.register([
      {
        name: 'USERS_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'ms-users',
          port: 3001,
        },
      },
    ]),
  ],
  controllers: [CalendarController, CalendarTcpController],
  providers: [
    CalendarService,
    GoogleCalendarService,
    CalendarRemindersService
  ],
  exports: [CalendarService, GoogleCalendarService],
})
export class CalendarModule {}