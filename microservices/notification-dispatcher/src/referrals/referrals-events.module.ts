import { Module } from '@nestjs/common';
import { ReferralsEventsListener } from './referrals-events.listener';
import { NotificationsModule } from '../notifications/notifications.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [KafkaModule, NotificationsModule],
  providers: [ReferralsEventsListener],
  exports: [ReferralsEventsListener],
})
export class ReferralsEventsModule {}