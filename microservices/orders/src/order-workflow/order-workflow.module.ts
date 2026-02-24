import { Module } from '@nestjs/common';
import { OrderWorkflowService } from './order-workflow.service';
import { OrderWorkflowController } from './order-workflow.controller';
import { Order } from './entities/order.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';
import { Device } from '../devices/entities/device.entity';
import { OrderStatusHistory } from './entities/order_status_history.entity';
import { OrderDelivery } from './entities/order-delivery.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentType } from './entities/payment-type.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { PaymentCatalogSeederService } from './payment-catalog-seeder.service';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { Attachment } from '../order-findings/entities/attachment.entity';

@Module({
  imports: [AwsS3Module, TypeOrmModule.forFeature([Order, UserEmployeeCache, Device, OrderStatusHistory,
    OrderStatusHistory, OrderDelivery, PaymentMethod, PaymentType, OrderPayment, Attachment])],
  controllers: [OrderWorkflowController],
  providers: [OrderWorkflowService, PaymentCatalogSeederService],
})
export class OrderWorkflowModule { }
