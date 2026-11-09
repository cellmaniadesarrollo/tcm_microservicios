import { Module } from '@nestjs/common';
import { ReferralLinksService } from './referral-links.service';
import { ReferralLinksController } from './referral-links.controller';

@Module({
  providers: [ReferralLinksService],
  controllers: [ReferralLinksController]
})
export class ReferralLinksModule {}
