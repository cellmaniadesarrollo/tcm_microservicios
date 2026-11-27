import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicePurchase } from './entities/device-purchase.entity';
import { DevicePurchasePayment } from './entities/device-purchase-payment.entity';
import { Attachment } from '../order-findings/entities/attachment.entity';
import { Order } from '../order-workflow/entities/order.entity';
import { PaymentType } from '../order-workflow/entities/payment-type.entity';
import { PaymentMethod } from '../order-workflow/entities/payment-method.entity';
import { DevicePurchasesController } from './controllers/device-purchases.controller';
import { DevicePurchasesService } from './services/device-purchases.service';
import { AwsS3Module } from '../aws-s3/aws-s3.module';

@Module({
    imports: [TypeOrmModule.forFeature([
        DevicePurchase, DevicePurchasePayment, Attachment, Order, PaymentType, PaymentMethod
    ]),
        AwsS3Module],
    controllers: [DevicePurchasesController],
    providers: [DevicePurchasesService],
    exports: [DevicePurchasesService],
})
export class DevicePurchasesModule { }
