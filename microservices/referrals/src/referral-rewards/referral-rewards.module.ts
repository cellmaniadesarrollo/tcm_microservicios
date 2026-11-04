import { Module } from '@nestjs/common';
import { ReferralRewardsService } from './referral-rewards.service';
import { ReferralRewardsController } from './referral-rewards.controller';

@Module({
  providers: [ReferralRewardsService],
  controllers: [ReferralRewardsController]
})
export class ReferralRewardsModule {}
