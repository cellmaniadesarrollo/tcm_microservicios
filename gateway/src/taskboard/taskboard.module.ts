// gateway/src/taskboard/taskboard.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';  // ← AGREGAR
import { TaskboardController } from './taskboard.controller';
import { TaskboardService } from './taskboard.service';
import { GoogleRedirectController } from './google-redirect.controller';

@Module({
  imports: [
    HttpModule,  // ← AGREGAR
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
        name: 'USERS_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'ms-users',
          port: 3001,
        },
      },
      {
        name: 'NOTIFICATIONS_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'ms-notifications', 
          port: 3003,
        },
      },
    ]),
  ],
  controllers: [
    TaskboardController,
    GoogleRedirectController
  ],
  providers: [TaskboardService],
  exports: [TaskboardService],
})
export class TaskboardModule {}