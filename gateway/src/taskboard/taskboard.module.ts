// gateway/src/taskboard/taskboard.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TaskboardController } from './taskboard.controller';
import { TaskboardService } from './taskboard.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'TASKBOARD_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'ms-task-board',
          port: 3000,
        },
      },
      {
        name: 'USERS_CLIENT',  // ✅ Nuevo cliente para usuarios
        transport: Transport.TCP,
        options: {
          host: 'ms-users',
          port: 3001,
        },
      },
      {
        name: 'NOTIFICATIONS_CLIENT',  // ✅ Agregar cliente de notificaciones
        transport: Transport.TCP,
        options: {
          host: 'ms-notifications', 
          port: 3003,
        },
      },
    ]),
  ],
  controllers: [TaskboardController],
  providers: [TaskboardService],
  exports: [TaskboardService],
})
export class TaskboardModule {}