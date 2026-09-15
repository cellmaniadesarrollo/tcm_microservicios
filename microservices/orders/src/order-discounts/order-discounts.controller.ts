import { Controller } from '@nestjs/common';
import { OrderDiscountsService } from './order-discounts.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('order-discounts')
export class OrderDiscountsController {
  constructor(private readonly orderDiscountsService: OrderDiscountsService) { }

  @MessagePattern({ cmd: 'register_order_discount' })
  async registerOrderDiscount(@Payload() data: any) {
    try {
      if (!data.orderId || !data.user || !data.body) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta orderId, user o body');
      }

      return await this.orderDiscountsService.registrarDescuento(data.orderId, data.body, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (registerOrderDiscount):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  @MessagePattern({ cmd: 'get_order_discounts' })
  async getOrderDiscounts(@Payload() data: any) {
    try {
      if (!data.orderId || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta orderId o user');
      }

      return await this.orderDiscountsService.getDescuentos(data.orderId, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (getOrderDiscounts):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  @MessagePattern({ cmd: 'delete_order_discount' })
  async deleteOrderDiscount(@Payload() data: any) {
    try {
      if (!data.discountId || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta discountId o user');
      }

      return await this.orderDiscountsService.eliminarDescuento(data.discountId, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (deleteOrderDiscount):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }
}
