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

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_user_notifications' },
        { userId, page, limit }
      )
    );
  }

  async getAuditHistory(entityType: string, entityId: string, companyId: string) {
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'get_audit_history' },
        { entityType, entityId, companyId }
      )
    );
  }

  async markAsRead(notificationId: string, userId: string) {
    return await lastValueFrom(
      this.notificationsClient.send(
        { cmd: 'mark_as_read' },
        { id: notificationId, userId }
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