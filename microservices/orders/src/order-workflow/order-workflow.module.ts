//microservices\orders\src\order-workflow\order-workflow.module.ts
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
import { OrderNote } from './entities/order-note.entity';
import { OrderNoteLog } from './entities/order-note-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { SearchHistoryModule } from '../search-history/search-history.module';
import { DevicesModule } from '../devices/devices.module';
import { OrderShipping } from './entities/order-shipping.entity';
import { OrderShippingService } from './order-shipping.service';
import { OrderPotentialPurchase } from '../order-potential-purchase/entities/order-potential-purchase.entity';

@Module({
  imports: [UsersEmployeesEventsModule, NotificationsModule, AwsS3Module,
    TypeOrmModule.forFeature([Order, UserEmployeeCache, Device, OrderStatusHistory,
      OrderStatusHistory, OrderDelivery, PaymentMethod, PaymentType, OrderPayment,
      Attachment, OrderNote, OrderNoteLog, OrderShipping, OrderPotentialPurchase]),
    BroadcastModule, SearchHistoryModule, DevicesModule],
  controllers: [OrderWorkflowController],
  providers: [OrderWorkflowService, PaymentCatalogSeederService, OrderShippingService],

  exports: [OrderWorkflowService],
})
export class OrderWorkflowModule { }
