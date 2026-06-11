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

    // ============================================
  // ✅ NUEVOS MÉTODOS
  // ============================================

  async updateObservations(id: string, observations: string) {
    console.log(`📤 [Gateway] updateObservations - id: ${id}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'update_observations' },
        { id, observations }
      )
    );
  }

  async rescheduleNotification(id: string, scheduledFor: Date, observations?: string) {
    console.log(`📤 [Gateway] rescheduleNotification - id: ${id}, scheduledFor: ${scheduledFor}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'reschedule_notification' },
        { id, scheduledFor, observations }
      )
    );
  }

  async cancelScheduling(id: string) {
    console.log(`📤 [Gateway] cancelScheduling - id: ${id}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'cancel_scheduling' },
        { id }
      )
    );
  }

  async getScheduledNotifications(currentDate: Date) {
    console.log(`📤 [Gateway] getScheduledNotifications - currentDate: ${currentDate}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_scheduled_notifications' },
        { currentDate }
      )
    );
  }

  async getFutureNotifications(page: number = 1, limit: number = 20) {
    console.log(`📤 [Gateway] getFutureNotifications - page: ${page}, limit: ${limit}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_future_notifications' },
        { page, limit }
      )
    );
  }

  async getDeliveredNotifications(page: number = 1, limit: number = 20, includeArchived: boolean = false) {
    console.log(`📤 [Gateway] getDeliveredNotifications - page: ${page}, limit: ${limit}, includeArchives: ${includeArchived}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_delivered_notifications' },
        { page, limit, includeArchived }
      )
    );
  }

  async getFinishedOrdersOverThreeMonths(
    page: number = 1,
    limit: number = 20,
    includeArchived: boolean = false
  ) {
    console.log(`📤 [Gateway] getFinishedOrdersOverThreeMonths - page: ${page}, limit: ${limit}, includeArchived: ${includeArchived}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_finished_orders_over_three_months' },
        { page, limit, includeArchived }
      )
    );
  }

  async updateNotificationNotes(
    notificationId: string,
    userId: string,
    notes: string
  ) {
    console.log(`📝 [Gateway] updateNotificationNotes - id: ${notificationId}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'update_notification_notes' },
        { notificationId, userId, notes }
      )
    );
  }

  async archiveNotification(
    notificationId: string,
    userId: string,
    archived: boolean
  ) {
    console.log(`📦 [Gateway] archiveNotification - id: ${notificationId}, archived: ${archived}`);
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'archive_notification' },
        { notificationId, userId, archived }
      )
    );
  }
}