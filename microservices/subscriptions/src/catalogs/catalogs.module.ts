import { Module } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingCycle } from './entities/billing-cycle.entity';
import { SubscriptionStatus } from './entities/subscription-status.entity';
import { Feature } from './entities/feature.entity';
import { Resource } from './entities/resource.entity';

@Module({
    imports: [
    TypeOrmModule.forFeature([
      BillingCycle,
      SubscriptionStatus,
      Feature,
      Resource,
    ]),
  ],
  controllers: [CatalogsController],
  providers: [CatalogsService],
})
export class CatalogsModule {}
