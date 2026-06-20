// task-board/src/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarTcpController } from './calendar-tcp.controller'; // ← Importar el TCP controller
import { CalendarService } from './calendar.service';
import { EmployeeTask } from './entities/employee-task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeTask])],
  controllers: [
    CalendarController,     // ← Para HTTP (REST)
    CalendarTcpController   // ← Para TCP (Microservicio)
  ],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}