import { Module } from '@nestjs/common';
import { AcquisitionService } from './acquisition.service';
import { AcquisitionController } from './acquisition.controller';
import { PlatformsModule } from './platforms/platforms.module';
import { ChannelsModule } from './channels/channels.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PublicationsModule } from './publications/publications.module';

@Module({
  providers: [AcquisitionService],
  controllers: [AcquisitionController],
  imports: [PlatformsModule, ChannelsModule, CampaignsModule, PublicationsModule]
})
export class AcquisitionModule {}
