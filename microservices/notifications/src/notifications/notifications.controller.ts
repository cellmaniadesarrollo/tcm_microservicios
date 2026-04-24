// microservices/notifications/src/notifications/notifications.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, EventPattern, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { TrackActionDto } from './dto/track-action.dto';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // 📌 Para UI: Obtener notificaciones de un usuario
  @MessagePattern({ cmd: 'get_user_notifications' })
  async getUserNotifications(@Payload() data: { userId: string; page?: number; limit?: number }) {
    return this.notificationsService.getUserNotifications(data.userId, data.page, data.limit);
  }

  // 📌 Para UI: Marcar como leída
  @MessagePattern({ cmd: 'mark_as_read' })
  async markAsRead(@Payload() data: { id: string; userId: string }) {
    return this.notificationsService.markAsRead(data.id, data.userId);
  }

  // 📌 Para auditoría: Registrar que el usuario accedió a la orden
  @MessagePattern({ cmd: 'track_access' })
  async trackAccess(@Payload() data: TrackActionDto) {
    return this.notificationsService.trackAccess(
      data.notificationId,
      data.userId,
      data.actionData
    );
  }

  // 📌 Para auditoría: Obtener historial de una entidad
  @MessagePattern({ cmd: 'get_audit_history' })
  async getAuditHistory(@Payload() data: { entityType: string; entityId: string; companyId: string }) {
    return this.notificationsService.getAuditHistory(data.entityType, data.entityId, data.companyId);
  }

  // 📌 Para auditoría: Obtener estadísticas
  @MessagePattern({ cmd: 'get_audit_stats' })
  async getAuditStats(@Payload() data: { companyId: string; startDate: Date; endDate: Date }) {
    return this.notificationsService.getAuditStats(data.companyId, data.startDate, data.endDate);
  }

  // 🎯 Escuchar eventos de RabbitMQ (desde el servicio de órdenes)
  @EventPattern('order.created')
  async handleOrderCreated(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.created`);
    await this.notificationsService.createFromOrderEvent({ ...event, action: 'created' });
    
    // Confirmar mensaje (importante para no perderlo)
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('order.updated')
  async handleOrderUpdated(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.updated`);
    await this.notificationsService.createFromOrderEvent({ ...event, action: 'updated' });
    
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('order.status_changed')
  async handleOrderStatusChanged(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.status_changed`);
    await this.notificationsService.createFromOrderEvent(event);
    
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('order.viewed')
  async handleOrderViewed(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.viewed`);
    await this.notificationsService.createFromOrderEvent({ ...event, action: 'viewed' });
    
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
}