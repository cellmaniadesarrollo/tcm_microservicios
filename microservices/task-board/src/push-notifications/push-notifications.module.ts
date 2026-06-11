// src/push-notifications/push-notifications.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';
import { PushSubscription } from './entities/push-subscription.entity';
import { BoardsModule } from '../boards/boards.module'; // ✅ Importar BoardsModule

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription]),
    forwardRef(() => BoardsModule), // ✅ Importar BoardsModule con forwardRef
  ],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}