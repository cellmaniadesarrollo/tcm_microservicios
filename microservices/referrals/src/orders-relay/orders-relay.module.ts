import { Module } from '@nestjs/common';
import { ReferralProfilesModule } from '../referral-profiles/referral-profiles.module';
import { KafkaModule } from '../kafka/kafka.module';
import { OrdersRelayController } from './orders-relay.controller';
import { OrdersRelayService } from './orders-relay.service';
import { OrdersEventsListener } from './orders-events.listener';

@Module({
  imports: [ReferralProfilesModule, KafkaModule],
  controllers: [OrdersRelayController],
  providers: [OrdersRelayService, OrdersEventsListener],
  exports: [OrdersEventsListener], // el orquestador lo necesita
})
export class OrdersRelayModule {}