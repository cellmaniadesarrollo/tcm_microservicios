import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrintController } from './print.controller';
import { OrderPrintStatus, OrderPrintStatusSchema } from './schemas/order-print-status.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersRelayModule } from '../orders-relay/orders-relay.module';
import { OrderPrintLog, OrderPrintLogSchema } from './schemas/order-print-log.schema';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { FinesModule } from '../fines/fines.module';

@Module({
  imports: [MongooseModule.forFeature([
    { name: OrderPrintStatus.name, schema: OrderPrintStatusSchema },
    { name: OrderPrintLog.name, schema: OrderPrintLogSchema },

  ]),
    OrdersRelayModule,
    UsersEmployeesEventsModule,
    FinesModule
  ],
  controllers: [PrintController],
  providers: [PrintService],
})
export class PrintModule { }
