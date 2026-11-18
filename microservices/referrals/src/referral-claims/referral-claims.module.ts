import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralClaim } from './entities/referral-claim.entity';
import { ReferralProfile } from '../referral-profiles/entities/referral-profile.entity';
import { CustomerCache } from '../customers-events/entities/customer-cache.entity';
import { ReferralClaimsService } from './referral-claims.service';
import { ReferralClaimsController } from './referral-claims.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralClaim, ReferralProfile, CustomerCache]),
  ],
  providers: [ReferralClaimsService],
  controllers: [ReferralClaimsController],
})
export class ReferralClaimsModule {}