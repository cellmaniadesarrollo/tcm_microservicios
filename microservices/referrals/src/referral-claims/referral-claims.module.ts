import { Module } from '@nestjs/common';
import { ReferralClaimsService } from './referral-claims.service';
import { ReferralClaimsController } from './referral-claims.controller';

@Module({
  providers: [ReferralClaimsService],
  controllers: [ReferralClaimsController]
})
export class ReferralClaimsModule {}
