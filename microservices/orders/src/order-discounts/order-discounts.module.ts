import { Module } from '@nestjs/common';
import { OrderDiscountsService } from './order-discounts.service';
import { OrderDiscountsController } from './order-discounts.controller';
import { OrderDiscount } from './entities/order-discount.entity';
import { Order } from '../order-workflow/entities/order.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([OrderDiscount, Order])],
  controllers: [OrderDiscountsController],
  providers: [OrderDiscountsService],
  exports: [OrderDiscountsService],
})
export class OrderDiscountsModule { }
