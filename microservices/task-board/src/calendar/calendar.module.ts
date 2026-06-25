// src/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CalendarController } from './calendar.controller';
import { CalendarTcpController } from './calendar-tcp.controller';
import { CalendarService } from './calendar.service';
import { GoogleCalendarService } from './google-calendar.service';
import { EmployeeTask } from './entities/employee-task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeTask]),
    ConfigModule,
  ],
  controllers: [CalendarController, CalendarTcpController],
  providers: [
    CalendarService,
    GoogleCalendarService,
  ],
  exports: [CalendarService, GoogleCalendarService],
})
export class CalendarModule {}