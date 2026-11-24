import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountsController } from './controllers/discounts.controller';
import { Discount } from './entities/discount.entity';
import { DocumentDiscount } from './entities/document-discount.entity';
import { DiscountsService } from './services/discounts.service';
import { DiscountsExpiryCron } from './cron/discounts-expiry.cron';
import { DiscountDefaultsSeed } from './seed/discount-defaults.seed';
import { CompanyReplica } from '../companies/entities/company-replica.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentDiscount, Discount, CompanyReplica])],
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountsExpiryCron, DiscountDefaultsSeed],
  exports: [DiscountsService, DiscountDefaultsSeed],
})
export class DiscountsModule {}