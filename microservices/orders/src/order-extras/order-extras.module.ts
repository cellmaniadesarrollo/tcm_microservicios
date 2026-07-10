
import { OrderExtrasService } from './order-extras.service';
import { OrderExtrasController } from './order-extras.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderPendingProduct } from './entities/order-pending-product.entity';
import { OrderExtraService } from './entities/order-extra-service.entity';
import { OrderServiceType } from './entities/order-service-type.entity';
import { Module } from '@nestjs/common';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderPendingProduct,
      OrderExtraService,
      OrderServiceType,
    ]),
  ],
  controllers: [OrderExtrasController],
  providers: [OrderExtrasService],
})
export class OrderExtrasModule {

}
