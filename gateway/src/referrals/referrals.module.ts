import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}