import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ReferralProfile } from './entities/referral-profile.entity';
import { ReferralProfilesService } from './referral-profiles.service';
import { ReferralProfilesController } from './referral-profiles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralProfile]),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [ReferralProfilesController],
  providers: [ReferralProfilesService],
  exports: [ReferralProfilesService],
})
export class ReferralProfilesModule {}