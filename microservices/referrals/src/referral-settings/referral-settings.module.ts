import { Module } from '@nestjs/common';
import { ReferralSettingsService } from './referral-settings.service';
import { ReferralSettingsController } from './referral-settings.controller';

@Module({
  providers: [ReferralSettingsService],
  controllers: [ReferralSettingsController]
})
export class ReferralSettingsModule {}
