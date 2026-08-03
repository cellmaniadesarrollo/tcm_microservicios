
import { OrderExtrasService } from './order-extras.service';
import { OrderExtrasController } from './order-extras.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderPendingProduct } from './entities/order-pending-product.entity';
import { OrderExtraService } from './entities/order-extra-service.entity';
import { OrderServiceType } from './entities/order-service-type.entity';
import { Module } from '@nestjs/common';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { Attachment } from '../order-findings/entities/attachment.entity';
@Module({
  imports: [
    AwsS3Module,
    TypeOrmModule.forFeature([
      OrderPendingProduct,
      OrderExtraService,
      OrderServiceType,
      Attachment
    ]),
  ],
  controllers: [OrderExtrasController],
  providers: [OrderExtrasService],
})
export class OrderExtrasModule {

}
