import { Controller } from '@nestjs/common';
import { OrdersReportsService } from './orders-reports.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller('orders-reports')
export class OrdersReportsController {
  constructor(private readonly ordersReportsService: OrdersReportsService) { }

  @MessagePattern({ cmd: 'fetch_customer_for_dashboard_orders' })
  async listOrders(
    user: {
      userId: string;
      companyId: string;
      branchId: string;

    }) {
    console.log(user)
    return true
  }
}
