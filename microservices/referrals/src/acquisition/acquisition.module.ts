import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcquisitionController } from './acquisition.controller';
import { AcquisitionService } from './acquisition.service';
import { CustomerAcquisition } from './entities/customer-acquisition.entity';
import { AcqPlatform } from './platforms/entities/acq-platform.entity';
import { AcqChannel } from './channels/entities/acq-channel.entity';
import { AcqCampaign } from './campaigns/entities/acq-campaign.entity';
import { AcqPublication } from './publications/entities/acq-publication.entity';
import { ReferralProfile } from '../referral-profiles/entities/referral-profile.entity';
import { CustomerCache } from '../customers-events/entities/customer-cache.entity';
import { ReferralClaim } from '../referral-claims/entities/referral-claim.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    CustomerAcquisition, AcqPlatform, AcqChannel, AcqCampaign, AcqPublication,
    ReferralProfile, CustomerCache, ReferralClaim,
  ])],
  controllers: [AcquisitionController],
  providers: [AcquisitionService],
})
export class AcquisitionModule {}