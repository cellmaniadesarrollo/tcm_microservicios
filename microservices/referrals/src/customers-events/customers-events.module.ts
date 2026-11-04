import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerCache } from './entities/customer-cache.entity';
import { CustomersEventsService } from './customers-events.service';
import { CustomersEventsController } from './customers-events.controller';
import { CustomersEventsListener } from './customers-events.listener';
import { ReferralProfilesModule } from '../referral-profiles/referral-profiles.module';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerCache]), ReferralProfilesModule],
  controllers: [CustomersEventsController],
  providers: [CustomersEventsService, CustomersEventsListener],
  exports: [CustomersEventsListener],
})
export class CustomersEventsModule {}