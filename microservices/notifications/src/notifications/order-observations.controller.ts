// src/notifications/order-observations.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderObservationsService } from './order-observations.service';
import { CreateOrderObservationDto, UpdateOrderObservationDto } from './dto/order-observation.dto';

@Controller('order-observations')
export class OrderObservationsController {
  constructor(private readonly observationsService: OrderObservationsService) {}

  @MessagePattern({ cmd: 'create_order_observation' })
  async create(@Payload() dto: CreateOrderObservationDto) {
    console.log(`📝 [Notifications] Creando observación para orden ${dto.orderId}`);
    return this.observationsService.create(dto);
  }

  @MessagePattern({ cmd: 'get_order_observations' })
  async findByOrderId(@Payload() data: { orderId: string; page?: number; limit?: number }) {
    console.log(`📋 [Notifications] Obteniendo observaciones para orden ${data.orderId}`);
    return this.observationsService.findByOrderId(data.orderId, data.page, data.limit);
  }

  @MessagePattern({ cmd: 'get_user_observations' })
  async findByUserId(@Payload() data: { userId: string; page?: number; limit?: number }) {
    console.log(`📋 [Notifications] Obteniendo observaciones del usuario ${data.userId}`);
    return this.observationsService.findByUserId(data.userId, data.page, data.limit);
  }

  @MessagePattern({ cmd: 'update_order_observation' })
  async update(@Payload() data: { id: string; dto: UpdateOrderObservationDto }) {
    console.log(`✏️ [Notifications] Actualizando observación ${data.id}`);
    return this.observationsService.update(data.id, data.dto);
  }

  @MessagePattern({ cmd: 'delete_order_observation' })
  async delete(@Payload() data: { id: string }) {
    console.log(`🗑️ [Notifications] Eliminando observación ${data.id}`);
    return this.observationsService.delete(data.id);
  }

  @MessagePattern({ cmd: 'delete_order_observations_by_order' })
  async deleteByOrderId(@Payload() data: { orderId: string }) {
    console.log(`🗑️ [Notifications] Eliminando observaciones para orden ${data.orderId}`);
    return this.observationsService.deleteByOrderId(data.orderId);
  }
}