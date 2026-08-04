import { Module } from '@nestjs/common';
import { OrdersReportsService } from './orders-reports.service';
import { OrdersReportsController } from './orders-reports.controller';
import { OrdersRelayModule } from '../orders-relay/orders-relay.module';
import { CompaniesModule } from '../companies/companies.module';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderValidation, OrderValidationSchema } from '../order-validation/schemas/order-validation.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: OrderValidation.name, schema: OrderValidationSchema }
  ]),
    OrdersRelayModule,
    CompaniesModule,
    UsersEmployeesEventsModule,
  ],
  controllers: [OrdersReportsController],
  providers: [OrdersReportsService],
})
export class OrdersReportsModule { }
