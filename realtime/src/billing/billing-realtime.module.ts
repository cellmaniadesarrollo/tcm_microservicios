import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { BillingRabbitmqController } from './controllers/billing-rabbitmq.controller';

@Module({
  imports: [SyncModule],
  controllers: [BillingRabbitmqController],
})
export class BillingRealtimeModule {}