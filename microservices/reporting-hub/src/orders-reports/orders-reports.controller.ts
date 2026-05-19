import { Controller } from '@nestjs/common';
import { OrdersReportsService } from './orders-reports.service';
import { MessagePattern } from '@nestjs/microservices';
import { GetOrdersFilterDto } from './dto/order-filters-metadata.dto';

@Controller('orders-reports')
export class OrdersReportsController {
  constructor(private readonly ordersReportsService: OrdersReportsService) { }

  @MessagePattern({ cmd: 'get_order_filters_metadata' })
  async getOrderFiltersMetadata(data: {
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    },
  }

  ) {
    return this.ordersReportsService.getOrderFiltersMetadata(data.user.companyId);
  }

  @MessagePattern({ cmd: 'get_order_list_metadata' })
  async getOrderList(data: {
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    },
    data: GetOrdersFilterDto
  }

  ) {
    return this.ordersReportsService.getOrdersList(data.user.companyId, data.data);
  }

  @MessagePattern({ cmd: 'get_order_detail' })
  async getOrderDetail(data: {
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
    orderId: number;
  }) {
    return this.ordersReportsService.getOrderDetail(data.user.companyId, data.orderId);
  }
  @MessagePattern({ cmd: 'fetch_customer_for_dashboard_orders' })
  async listOrders(
    user: {
      userId: string;
      companyId: string;
      branchId: string;

    }) {

    return true
  }
  @MessagePattern({ cmd: 'get_dashboard' })
  async getDashboard(data: {
    user: { sub: string; companyId: string; groups: string[] }
  }) {

    const datas = await this.ordersReportsService.getDashboard(
      data.user.companyId,
      data.user.sub,
      data.user.groups,
    );

    return datas
  }

  @MessagePattern({ cmd: 'get_dashboard_drill' })
  async getDashboardDrill(data: {
    user: { userId: string; companyId: string; branchId: string };
    card: string;
    page: number;
    limit: number;
  }) {
    return this.ordersReportsService.getDashboardDrill(
      data.user.companyId,
      data.card,
      data.page,
      data.limit,
    );
  }
  @MessagePattern({ cmd: 'get_admin_dashboard_range' })
  async getAdminDashboardRange(data: {
    user: {
      userId: string;
      companyId: string;
      // branchId?: string;
    };
    from: string;
    to: string;
  }) {
    return this.ordersReportsService.getAdminDashboardRange(
      data.user.companyId,
      data.from,
      data.to
    );
  }

}
