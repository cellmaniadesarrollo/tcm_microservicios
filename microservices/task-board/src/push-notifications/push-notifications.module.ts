// src/push-notifications/push-notifications.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsTcpController } from './push-notifications.tcp.controller';
import { PushNotificationsService } from './push-notifications.service';
import { PushSubscription } from './entities/push-subscription.entity';
import { BoardsModule } from '../boards/boards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription]),
    forwardRef(() => BoardsModule),
  ],
  controllers: [
    PushNotificationsController,
    PushNotificationsTcpController,
  ],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}