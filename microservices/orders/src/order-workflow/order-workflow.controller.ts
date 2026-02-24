import { Controller } from '@nestjs/common';
import { OrderWorkflowService } from './order-workflow.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { GetOrderFullDataDto } from './dto/get-order-full-data.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CloseOrderDto } from '../order-findings/dto/close-order.dto';
import { OrderDelivery } from './entities/order-delivery.entity';

@Controller('order-workflow')
export class OrderWorkflowController {
  constructor(private readonly orderWorkflowService: OrderWorkflowService) { }

  @MessagePattern({ cmd: 'create_order' })
  async createOrder(data: {
    dto: CreateOrderDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderWorkflowService.createOrder(
      data.dto,
      data.user,
    );
  }
  @MessagePattern({ cmd: 'list_orders' })
  async listOrders(data: {
    dto: ListOrdersDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderWorkflowService.listOrders(
      data.user,
      data.dto,
    );
  }
  @MessagePattern({ cmd: 'list_my_orders' })
  async listMyOrders(data: {
    dto: ListOrdersDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderWorkflowService.listMyOrders(
      data.user,
      data.dto,
    );
  }
  @MessagePattern({ cmd: 'get_order_full_data' })
  async getOrderFullData(data: {
    dto: GetOrderFullDataDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderWorkflowService.getOrderFullData(
      data.dto.orderId,
      data.user,
    );
  }

  @MessagePattern({ cmd: 'change_order_status' })
  async changeOrderStatus(data: {
    dto: ChangeOrderStatusDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderWorkflowService.changeOrderStatus(
      data.dto,
      data.user,
    );
  }
  @MessagePattern({ cmd: 'register_order_payment' })
  async registerPayment(
    @Payload() data: {
      dto: CreateOrderPaymentDto;
      user: {
        userId: string;
        companyId: string;
        branchId: string;
      };
    },
  ): Promise<any> {
    // Aquí el servicio ya lanza RpcException si algo falla
    return this.orderWorkflowService.registerIncomePayment(data.dto, data.user);
  }
  @MessagePattern({ cmd: 'close_order' })
  async closeOrder(
    @Payload() data: {
      dto: CloseOrderDto;
      user: { userId: string; companyId: string; branchId: string };
    },
  ): Promise<OrderDelivery> {
    return this.orderWorkflowService.closeOrder(data.dto, data.user);
  }

  @MessagePattern({ cmd: 'get_payment_catalogs' })
  async getPaymentCatalogs() {
    const [types, methods] = await Promise.all([
      this.orderWorkflowService.getPaymentTypes(),
      this.orderWorkflowService.getPaymentMethods(),
    ]);

    return { paymentTypes: types, paymentMethods: methods };
  }
}
