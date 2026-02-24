import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { Billing } from './entities/billing.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { IdentificationType } from '../catalogs/entities/identificationType.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Billing,Customer,IdentificationType])],
  providers: [BillingService],
  controllers: [BillingController]
})
export class BillingModule {}
