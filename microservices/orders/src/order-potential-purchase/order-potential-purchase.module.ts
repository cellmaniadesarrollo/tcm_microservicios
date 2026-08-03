// order-potential-purchase/order-potential-purchase.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderPotentialPurchase } from './entities/order-potential-purchase.entity';
import { Order } from '../order-workflow/entities/order.entity';
import { OrderPotentialPurchaseService } from './order-potential-purchase.service';
import { OrderPotentialPurchaseController } from './order-potential-purchase.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderPotentialPurchase, Order]),
  ],
  controllers: [OrderPotentialPurchaseController],
  providers: [OrderPotentialPurchaseService],
  exports: [OrderPotentialPurchaseService],
})
export class OrderPotentialPurchaseModule { }