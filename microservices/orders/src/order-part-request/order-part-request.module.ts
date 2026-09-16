import { Module } from '@nestjs/common';
import { OrderPartRequestService } from './order-part-request.service';
import { OrderPartRequestController } from './order-part-request.controller';
import { PartRequest } from './entities/part-request.entity';
import { PartRequestPayment } from './entities/part-request-payment.entity';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { Attachment } from '../order-findings/entities/attachment.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { Order } from '../order-workflow/entities/order.entity';
import { PartRequestSourcing } from './entities/part-request-sourcing.entity';
import { PartRequestShipping } from './entities/part-request-shipping.entity';
import { PartRequestArrival } from './entities/part-request-arrival.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartRequest,
      PartRequestPayment,
      PartRequestStatusHistory,
      Attachment, // ya debería estar exportado desde order-findings, revisa si conviene importarlo de ahí en vez de repetirlo
      Order,
      PartRequestSourcing,
      PartRequestShipping,
      PartRequestArrival
    ]),
    AwsS3Module
  ],
  controllers: [OrderPartRequestController],
  providers: [OrderPartRequestService],
})
export class OrderPartRequestModule { }
