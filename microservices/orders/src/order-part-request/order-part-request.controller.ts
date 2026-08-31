import { Controller } from '@nestjs/common';
import { OrderPartRequestService } from './order-part-request.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('order-part-request')
export class OrderPartRequestController {
  constructor(private readonly partRequestsService: OrderPartRequestService) { }

  @MessagePattern({ cmd: 'create_part_request' })
  async createPartRequest(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      const result = await this.partRequestsService.createPartRequest(
        data.dto,
        data.files ?? [],
        data.user,
      );

      console.log('✅ MS Órdenes - Solicitud de repuesto registrada');
      return result;
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (createPartRequest):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  @MessagePattern({ cmd: 'list_part_requests_by_order' })
  async listByOrder(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.listByOrder(data.dto.orderId, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listByOrder):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }
  @MessagePattern({ cmd: 'list_part_requests' })
  async listPartRequests(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.listPartRequests(data.dto, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listPartRequests):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }
}
