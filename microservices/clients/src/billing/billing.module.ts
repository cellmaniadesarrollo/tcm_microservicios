import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingData } from './entities/billing-data.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { IdentificationType } from '../catalogs/entities/identificationType.entity';
import { CustomerBillingData } from './entities/customer-billing-data.entity';
import { IdType } from '../catalogs/entities/id-type.entity';
import { ContactType } from '../catalogs/entities/contact-type.entity';
import { BroadcastModule } from '../broadcast/broadcast.module';

@Module({
  imports: [TypeOrmModule.forFeature([BillingData, Customer, IdentificationType, CustomerBillingData, ContactType,  // 👈
    IdType,]), BroadcastModule],
  providers: [BillingService],
  controllers: [BillingController]
})
export class BillingModule { }
