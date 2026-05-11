// gateway/src/notifications/notifications.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject('NOTIFICATIONS_CLIENT')
    private readonly notificationsClient: ClientProxy,
  ) {}

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20, onlyUnread: boolean = false) {
    console.log(`📤 [Gateway] Enviando a Notifications: get_user_notifications - userId: ${userId}, onlyUnread: ${onlyUnread}`);
    try {
      const result = await lastValueFrom(
        this.notificationsClient.send(
          { cmd: 'get_user_notifications' },
          { userId, page, limit, onlyUnread }
        )
      );
      console.log(`✅ [Gateway] Respuesta recibida: ${result.notifications?.length || 0} notificaciones, ${result.unreadCount} no leídas`);
      return result;
    } catch (error) {
      console.error(`❌ [Gateway] Error al comunicar con Notifications:`, error);
      throw error;
    }
  }

  // 🆕 Obtener contador de notificaciones NO LEÍDAS
  async getUnreadCount(userId: string) {
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_unread_count' },
        { userId }
      )
    );
  }

async getCurrentStuckOrders(userId: string, status: string = 'INGRESADO', days: number = 3) {
  console.log(`📤 [Gateway] Consultando órdenes estancadas - userId: ${userId}, status: ${status}, days: ${days}`);
  try {
    const result = await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_current_stuck_orders' },
        { userId, status, days }
      )
    );
    console.log(`✅ [Gateway] Encontradas: ${result.totalStuck} órdenes`);
    return result;
  } catch (error) {
    console.error(`❌ [Gateway] Error:`, error);
    throw error;
  }
}

  async getAuditHistory(entityType: string, entityId: string, companyId: string) {
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_audit_history' },
        { entityType, entityId, companyId }
      )
    );
  }

  async markAsRead(notificationId: string, userId: string, userName?: string) {
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'mark_as_read' },
        { id: notificationId, userId, userName, source: 'web' }
      )
    );
  }

  async trackAccess(notificationId: string, userId: string, actionData: any) {
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'track_access' },
        { notificationId, userId, actionData }
      )
    );
  }
}