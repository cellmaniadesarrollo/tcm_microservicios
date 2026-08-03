import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { PlanFeature } from './entities/plan-feature.entity';
import { PlanLimit } from './entities/plan-limit.entity';
import { BillingCycle } from '../catalogs/entities/billing-cycle.entity';
import { Feature } from '../catalogs/entities/feature.entity';
import { Resource } from '../catalogs/entities/resource.entity';

@Module({
    imports: [
    TypeOrmModule.forFeature([
      Plan,
      PlanFeature,
      PlanLimit,
      BillingCycle,
      Feature,
      Resource,
    ]),
  ],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
