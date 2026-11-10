import { Module } from '@nestjs/common';
import { ReferralProfilesModule } from '../referral-profiles/referral-profiles.module';
import { KafkaModule } from '../kafka/kafka.module'; // si no es @Global()
import { ReferralWelcomeService } from './referral-welcome.service';
import { ReferralWelcomeController } from './referral-welcome.controller';

@Module({
  imports: [ReferralProfilesModule, KafkaModule],
  controllers: [ReferralWelcomeController],
  providers: [ReferralWelcomeService],
  exports: [ReferralWelcomeService],
})
export class ReferralWelcomeModule {}