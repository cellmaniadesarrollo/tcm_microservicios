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
import { Provider } from './entities/provider.entity';
import { ProviderAccount } from './entities/provider-account.entity';
import { SourcingProviderAccount } from './entities/sourcing-provider-account.entity';
import { PartRequestPaymentAllocation } from './entities/part-request-payment-allocation.entity';
import { PartRequestService } from './part-request.service';
import { PartRequestSourcingService } from './part-request-sourcing.service';
import { PartRequestPaymentService } from './part-request-payment.service';
import { PartRequestArrivalService } from './part-request-arrival.service';
import { OrderPendingProduct } from '../order-extras/entities/order-pending-product.entity';

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
      PartRequestArrival,
      Provider,
      ProviderAccount,
      SourcingProviderAccount,
      PartRequestPaymentAllocation,
      OrderPendingProduct
    ]),
    AwsS3Module
  ],
  controllers: [OrderPartRequestController],
  providers: [PartRequestService,
    PartRequestSourcingService,
    PartRequestPaymentService,
    PartRequestArrivalService,],
})
export class OrderPartRequestModule { }
