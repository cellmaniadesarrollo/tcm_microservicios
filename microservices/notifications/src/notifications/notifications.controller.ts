// microservices/notifications/src/notifications/notifications.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, EventPattern, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

@Controller('Notification-Save')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // 📌 Para UI: Obtener notificaciones de un usuario
  @MessagePattern({ cmd: 'get_user_notifications' })
  async getUserNotifications(@Payload() data: { 
    userId: string; 
    page?: number; 
    limit?: number; 
    onlyUnread?: boolean 
  }) {
    console.log(`📥 [Notifications] get_user_notifications - userId: ${data.userId}, onlyUnread: ${data.onlyUnread}`);
    const result = await this.notificationsService.getUserNotifications(
      data.userId, 
      data.page, 
      data.limit, 
      data.onlyUnread || false
    );
    console.log(`✅ [Notifications] Respuesta: ${result.notifications?.length || 0} notificaciones, ${result.unreadCount} no leídas`);
    return result;
  }

  // 🆕 Obtener solo el contador de notificaciones NO LEÍDAS
  @MessagePattern({ cmd: 'get_unread_count' })
  async getUnreadCount(@Payload() data: { userId: string }) {
    console.log(`📊 [Notifications] get_unread_count - userId: ${data.userId}`);
    return this.notificationsService.getUnreadCount(data.userId);
  }

  // 🆕 Obtener órdenes estancadas
  @MessagePattern({ cmd: 'get_current_stuck_orders' })
  async getCurrentStuckOrders(@Payload() data: { 
    userId: string; 
    status?: string; 
    days?: number 
  }) {
    const minDays = data.days !== undefined ? data.days : 3;
    console.log(`📊 [Notifications] Órdenes estancadas - userId: ${data.userId}, status: ${data.status || 'INGRESADO'}, days: ${minDays}`);
    const result = await this.notificationsService.getCurrentStuckOrders(
      data.userId,
      data.status || 'INGRESADO',
      minDays
    );
    console.log(`✅ [Notifications] Encontradas: ${result.totalStuck} órdenes`);
    return result;
  }

  // 📌 Para UI: Marcar como leída
  @MessagePattern({ cmd: 'mark_as_read' })
  async markAsRead(@Payload() data: { id: string; userId: string; userName?: string; source?: string }) {
    console.log(`📖 Marcando como leída: ${data.id} - usuario: ${data.userId}`);
    return this.notificationsService.markAsRead(data.id, data.userId, data.userName, data.source);
  }

  // 🆕 Registrar visualización
  @MessagePattern({ cmd: 'track_view' })
  async trackView(@Payload() data: { id: string; userId: string; userName?: string; source?: string; actionData?: any }) {
    console.log(`👁️ Registrando visualización: ${data.id} - usuario: ${data.userId}`);
    return this.notificationsService.trackView(data.id, data.userId, data.userName, data.source, data.actionData);
  }

  // 🆕 Obtener historial completo de una notificación
  @MessagePattern({ cmd: 'get_notification_history' })
  async getNotificationHistory(@Payload() data: { id: string }) {
    console.log(`📜 Obteniendo historial de notificación: ${data.id}`);
    return this.notificationsService.getNotificationHistory(data.id);
  }

  // 📌 Para auditoría: Registrar acceso
  @MessagePattern({ cmd: 'track_access' })
  async trackAccess(@Payload() data: any) {
    console.log(`🔍 Track access: ${data.notificationId}`);
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

  // 🎯 Escuchar eventos de RabbitMQ - USAR EL NUEVO MÉTODO
  @EventPattern('order.created')
  async handleOrderCreated(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.created`);
    await this.notificationsService.createOrUpdateFromOrderEvent({ ...event, action: 'created' });
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('order.updated')
  async handleOrderUpdated(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.updated`);
    await this.notificationsService.createOrUpdateFromOrderEvent({ ...event, action: 'updated' });
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('order.status_changed')
  async handleOrderStatusChanged(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.status_changed`);
    await this.notificationsService.createOrUpdateFromOrderEvent({ ...event, action: 'status_changed' });
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('order.viewed')
  async handleOrderViewed(@Payload() event: any, @Ctx() context: RmqContext) {
    console.log(`📨 Evento recibido: order.viewed`);
    await this.notificationsService.createOrUpdateFromOrderEvent({ ...event, action: 'viewed' });
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
}