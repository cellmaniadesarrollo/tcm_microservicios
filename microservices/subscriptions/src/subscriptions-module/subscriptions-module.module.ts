import { Module } from '@nestjs/common';
import { SubscriptionsModuleService } from './subscriptions-module.service';
import { SubscriptionsModuleController } from './subscriptions-module.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { Subscription } from './entities/subscriptions.entity';
import { Plan } from '../plans/entities/plan.entity';
import { SubscriptionStatus } from '../catalogs/entities/subscription-status.entity';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    CompanyReplica, Subscription, Plan, SubscriptionStatus,UserEmployeeCache

  ]),],
  controllers: [SubscriptionsModuleController],
  providers: [SubscriptionsModuleService],
  exports: [SubscriptionsModuleService],
})
export class SubscriptionsModuleModule { }
