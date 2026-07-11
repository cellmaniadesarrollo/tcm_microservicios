// order-extras.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderExtrasService } from './order-extras.service';
import { CreateOrderPendingProductDto } from './dto/create-order-pending-product.dto';
import { UpdateOrderPendingProductDto } from './dto/update-order-pending-product.dto';
import { UpdateOrderExtraServiceDto } from './dto/update-order-extra-service.dto';
import { CreateOrderExtraServiceDto } from './dto/create-order-extra-service.dto';

@Controller('order-extras')
export class OrderExtrasController {
  constructor(private readonly orderExtrasService: OrderExtrasService) { }

  @MessagePattern({ cmd: 'create_order_pending_product' })
  async createPendingProduct(
    @Payload() data: {
      dto: CreateOrderPendingProductDto;
      user: { userId: string; companyId: string };
    },
  ) {
    return this.orderExtrasService.createPendingProduct(data.dto, data.user);
  }

  @MessagePattern({ cmd: 'update_order_pending_product' })
  async updatePendingProduct(
    @Payload() data: {
      id: number;
      dto: UpdateOrderPendingProductDto;
      user: { userId: string; companyId: string };
    },
  ) {
    return this.orderExtrasService.updatePendingProduct(data.id, data.dto, data.user);
  }

  @MessagePattern({ cmd: 'delete_order_pending_product' })
  async deletePendingProduct(
    @Payload() data: { id: number; user: { userId: string; companyId: string } },
  ) {
    return this.orderExtrasService.softDeletePendingProduct(data.id, data.user);
  }
  @MessagePattern({ cmd: 'create_order_extra_service' })
  async createExtraService(
    @Payload() data: {
      dto: CreateOrderExtraServiceDto;
      user: { userId: string; companyId: string };
    },
  ) {
    return this.orderExtrasService.createExtraService(data.dto, data.user);
  }

  @MessagePattern({ cmd: 'update_order_extra_service' })
  async updateExtraService(
    @Payload() data: {
      id: number;
      dto: UpdateOrderExtraServiceDto;
      user: { userId: string; companyId: string };
    },
  ) {
    return this.orderExtrasService.updateExtraService(data.id, data.dto, data.user);
  }

  @MessagePattern({ cmd: 'delete_order_extra_service' })
  async deleteExtraService(
    @Payload() data: { id: number; user: { userId: string; companyId: string } },
  ) {
    return this.orderExtrasService.softDeleteExtraService(data.id, data.user);
  }
  @MessagePattern({ cmd: 'list_order_service_types' })
  async listServiceTypes() {
    return this.orderExtrasService.listServiceTypes();
  }
}