import { Module } from '@nestjs/common';
import { OrderFindingsService } from './order-findings.service';
import { OrderFindingsController } from './order-findings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './entities/attachment.entity';
import { FindingProcedure } from './entities/finding-procedure.entity';
import { OrderFinding } from './entities/order-finding.entity';
import { Order } from '../order-workflow/entities/order.entity';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { OrderPayment } from '../order-workflow/entities/order-payment.entity';
import { PaymentType } from '../order-workflow/entities/payment-type.entity';
import { PaymentMethod } from '../order-workflow/entities/payment-method.entity';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';

@Module({
  imports: [AwsS3Module, TypeOrmModule.forFeature([Attachment, FindingProcedure, OrderFinding, Order
  ])],
  controllers: [OrderFindingsController],
  providers: [OrderFindingsService],
})
export class OrderFindingsModule { }
