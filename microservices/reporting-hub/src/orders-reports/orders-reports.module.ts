import { Module } from '@nestjs/common';
import { OrdersReportsService } from './orders-reports.service';
import { OrdersReportsController } from './orders-reports.controller';

@Module({
  controllers: [OrdersReportsController],
  providers: [OrdersReportsService],
})
export class OrdersReportsModule {}
