import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralRewardsService } from './referral-rewards.service';
import { ReferralRewardsController } from './referral-rewards.controller';
import { ReferralReward } from './entities/referral-reward.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReferralReward])],
  providers: [ReferralRewardsService],
  controllers: [ReferralRewardsController],
  exports: [ReferralRewardsService],
})
export class ReferralRewardsModule {}