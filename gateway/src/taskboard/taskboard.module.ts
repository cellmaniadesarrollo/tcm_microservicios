// gateway/src/taskboard/taskboard.module.ts

import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';
import { HttpModule } from '@nestjs/axios';
import { TaskboardController } from './taskboard.controller';
import { TaskboardService } from './taskboard.service';
import { GoogleRedirectController } from './google-redirect.controller';

// 🔥 IMPORTAR JWT MODULE DESDE COMMON
import { JwtModule } from '../common/jwt/jwt.module';

// 🔥 IMPORTAR GUARDS
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { GroupsGuard } from '../common/auth/guards/groups.guard';
import { FeaturesGuard } from '../common/auth/guards/features.guard';
import { AuthModule } from '../common/auth/auth.module'; // ← Importar el AuthModule de common

@Module({
  imports: [
    // 🔥 USAR EL JWT MODULE EXISTENTE
    JwtModule,
    
    HttpModule,
    AuthModule, // ← AGREGAR - Este es el que tiene los guards
    HttpModule,
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
  providers: [
    TaskboardService,
    // 🔥 REGISTRAR GUARDS
    JwtAuthGuard,
    GroupsGuard,
    FeaturesGuard,
  ],
  exports: [TaskboardService],
})
export class TaskboardModule {}