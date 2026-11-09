import { Module } from '@nestjs/common';
import { ReferralAuditService } from './referral-audit.service';
import { ReferralAuditController } from './referral-audit.controller';

@Module({
  providers: [ReferralAuditService],
  controllers: [ReferralAuditController]
})
export class ReferralAuditModule {}
