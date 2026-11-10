import { Module } from '@nestjs/common';
import { ReferralProfilesModule } from '../referral-profiles/referral-profiles.module';
import { ReferralWelcomeModule } from '../referral-welcome/referral-welcome.module'; // ★
import { KafkaModule } from '../kafka/kafka.module';
import { OrdersRelayController } from './orders-relay.controller';
import { OrdersRelayService } from './orders-relay.service';
import { OrdersEventsListener } from './orders-events.listener';

@Module({
  imports: [ReferralProfilesModule, ReferralWelcomeModule, KafkaModule], // ★
  controllers: [OrdersRelayController],
  providers: [OrdersRelayService, OrdersEventsListener],
  exports: [OrdersEventsListener],
})
export class OrdersRelayModule {}