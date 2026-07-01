// src/push-notifications/push-notifications.service.ts
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';
import { SubscriptionDto, SendNotificationDto } from './dto/subscription.dto';
import { BoardsService } from '../boards/boards.service';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  
  // Claves de fallback para que siempre funcione
  private static readonly FALLBACK_PUBLIC_KEY = 'BLf2Zx_rk72r7g75lXZiHpEehfI0F3PzRqX8Q3JkL5YxVn9XaBcDeFgHiJkLmNoPqRsTuVwXyZ';
  private static readonly FALLBACK_PRIVATE_KEY = 'VNlfcVVFB4V50tqKO8WFHHOhx_ZrabUkZ2BYVOnNg9A';

  constructor(
    @InjectRepository(PushSubscription)
    private subscriptionRepository: Repository<PushSubscription>,
    @Inject(forwardRef(() => BoardsService))
    private boardsService: BoardsService,
  ) {
    this.initVapidKeys();
  }

  private initVapidKeys() {
    try {
      let publicKey = process.env.VAPID_PUBLIC_KEY;
      let privateKey = process.env.VAPID_PRIVATE_KEY;
      let subject = process.env.VAPID_SUBJECT || 'mailto:admin@teamcellmania.com';

      // Si no hay claves en .env, usar las de fallback
      if (!publicKey || !privateKey) {
        this.logger.warn('⚠️ No se encontraron claves VAPID en .env. Usando claves de fallback.');
        publicKey = PushNotificationsService.FALLBACK_PUBLIC_KEY;
        privateKey = PushNotificationsService.FALLBACK_PRIVATE_KEY;
        this.logger.log('📢 Usando clave pública de fallback');
      }

      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('✅ Claves VAPID configuradas correctamente');
      
    } catch (error) {
      this.logger.error('❌ Error configurando claves VAPID:', error);
      // Intentar con claves de fallback
      webPush.setVapidDetails(
        'mailto:admin@teamcellmania.com',
        PushNotificationsService.FALLBACK_PUBLIC_KEY,
        PushNotificationsService.FALLBACK_PRIVATE_KEY,
      );
      this.logger.log('✅ Claves VAPID configuradas con fallback');
    }
  }

  getVapidPublicKey(): string {
    try {
      this.logger.log('🔍 Obteniendo clave VAPID pública...');
      
      // Intentar leer de variable de entorno
      if (process.env.VAPID_PUBLIC_KEY) {
        this.logger.log('✅ Usando VAPID_PUBLIC_KEY del .env');
        return process.env.VAPID_PUBLIC_KEY;
      }
      
      // Usar fallback
      this.logger.warn('⚠️ No hay VAPID_PUBLIC_KEY en .env, usando fallback');
      this.logger.log('📢 Usando VAPID_PUBLIC_KEY de fallback');
      return PushNotificationsService.FALLBACK_PUBLIC_KEY;
      
    } catch (error) {
      this.logger.error('❌ Error obteniendo VAPID key:', error);
      // 🔥 SIEMPRE devolver fallback
      return PushNotificationsService.FALLBACK_PUBLIC_KEY;
    }
  }

  async subscribe(userId: string, subscription: SubscriptionDto): Promise<PushSubscription> {
    this.logger.log(`📱 Suscribiendo usuario ${userId}`);

    const existing = await this.subscriptionRepository.findOne({
      where: {
        userId,
        endpoint: subscription.endpoint,
      },
    });

    if (existing) {
      existing.keys = subscription.keys;
      existing.expirationTime = subscription.expirationTime ?? null;
      existing.active = true;
      existing.updatedAt = new Date();
      await this.subscriptionRepository.save(existing);
      this.logger.log(`✅ Suscripción actualizada para usuario ${userId}`);
      return existing;
    }

    const newSubscription = new PushSubscription();
    newSubscription.userId = userId;
    newSubscription.endpoint = subscription.endpoint;
    newSubscription.expirationTime = subscription.expirationTime ?? null;
    newSubscription.keys = subscription.keys;
    newSubscription.active = true;
    newSubscription.createdAt = new Date();
    newSubscription.updatedAt = new Date();

    await this.subscriptionRepository.save(newSubscription);
    this.logger.log(`✅ Nueva suscripción guardada para usuario ${userId}`);
    return newSubscription;
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    this.logger.log(`❌ Desactivando suscripción para usuario ${userId}`);
    await this.subscriptionRepository.update(
      { userId, endpoint },
      { active: false, updatedAt: new Date() },
    );
  }

  async unsubscribeAll(userId: string): Promise<number> {
    this.logger.log(`❌ Eliminando todas las suscripciones del usuario ${userId}`);
    const result = await this.subscriptionRepository.update(
      { userId, active: true },
      { active: false, updatedAt: new Date() },
    );
    return result.affected || 0;
  }

  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.subscriptionRepository.find({
      where: { userId, active: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveSubscriptions(): Promise<number> {
    return this.subscriptionRepository.count({ where: { active: true } });
  }

  async getUsersWithSubscriptions(): Promise<number> {
    const result = await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .select('COUNT(DISTINCT subscription.userId)', 'count')
      .where('subscription.active = :active', { active: true })
      .getRawOne();
    return result?.count || 0;
  }

  async getAllActiveUserIds(): Promise<string[]> {
    const results = await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .select('DISTINCT subscription.userId', 'userId')
      .where('subscription.active = :active', { active: true })
      .getRawMany();
    return results.map(r => r.userId);
  }

  // ==================== MÉTODOS DE BOARDS ====================

  async getBoardMemberIds(boardId: string): Promise<string[]> {
    this.logger.log(`🔍 Buscando miembros del board ${boardId}`);
    
    try {
      const members = await this.boardsService.getMembers(boardId);
      const memberIds = members.map(member => member.userId);
      this.logger.log(`✅ Board ${boardId} tiene ${memberIds.length} miembros`);
      return memberIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`❌ Error obteniendo miembros del board ${boardId}: ${errorMessage}`);
      return [];
    }
  }

  async sendToBoardMembers(
    boardId: string,
    notification: Omit<SendNotificationDto, 'userId'>,
    excludeUserId?: string,
  ): Promise<number> {
    this.logger.log(`📨 Enviando notificación a miembros del board ${boardId}`);
    
    const memberIds = await this.getBoardMemberIds(boardId);
    
    if (memberIds.length === 0) {
      this.logger.warn(`⚠️ No se encontraron miembros para el board ${boardId}`);
      return 0;
    }
    
    let targetMembers = memberIds;
    if (excludeUserId) {
      targetMembers = memberIds.filter(id => id !== excludeUserId);
      this.logger.log(`📨 Excluyendo usuario ${excludeUserId}, quedan ${targetMembers.length} miembros`);
    }
    
    if (targetMembers.length === 0) {
      this.logger.warn(`⚠️ No hay miembros para notificar después de excluir`);
      return 0;
    }
    
    const fullNotification: SendNotificationDto = {
      userId: '',
      title: notification.title,
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      data: {
        ...notification.data,
        boardId,
      },
    };
    
    return this.sendToMultipleUsers(targetMembers, fullNotification);
  }

  async sendToUser(userId: string, notification: SendNotificationDto): Promise<number> {
    this.logger.log(`📨 Enviando notificación a usuario ${userId}: ${notification.title}`);
    
    const subscriptions = await this.subscriptionRepository.find({
      where: { userId, active: true },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(`⚠️ Usuario ${userId} no tiene suscripciones activas`);
      return 0;
    }

    let sentCount = 0;
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/assets/icons/icon-192x192.png',
      badge: notification.badge || '/assets/icons/badge-icon.png',
      data: notification.data || {},
      vibrate: [200, 100, 200],
      tag: notification.data?.taskId ? `task_${notification.data.taskId}` : undefined,
      requireInteraction: true,
    });

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        };

        await webPush.sendNotification(pushSubscription, payload);
        sentCount++;
        this.logger.log(`✅ Notificación enviada a ${subscription.endpoint.substring(0, 50)}...`);
      } catch (err) {
        const error = err as { statusCode?: number; message?: string };
        this.logger.error(`❌ Error enviando notificación: ${error.message || 'Error desconocido'}`);
        if (error.statusCode === 410) {
          await this.subscriptionRepository.update(
            { id: subscription.id },
            { active: false, updatedAt: new Date() },
          );
          this.logger.warn(`⚠️ Suscripción expirada, desactivada`);
        }
      }
    }

    return sentCount;
  }

  async sendToMultipleUsers(userIds: string[], notification: SendNotificationDto): Promise<number> {
    this.logger.log(`📨 Enviando notificación a ${userIds.length} usuarios`);
    
    let totalSent = 0;
    for (const userId of userIds) {
      totalSent += await this.sendToUser(userId, notification);
    }
    
    this.logger.log(`✅ Notificación enviada a ${totalSent} dispositivos`);
    return totalSent;
  }

  async sendToAllExcept(
    excludeUserId: string,
    notification: SendNotificationDto,
  ): Promise<number> {
    this.logger.log(`📨 Enviando notificación a todos excepto ${excludeUserId}`);
    
    const userIds = await this.getAllActiveUserIds();
    const filteredUserIds = userIds.filter(id => id !== excludeUserId);
    
    return this.sendToMultipleUsers(filteredUserIds, notification);
  }

  async sendToAll(notification: SendNotificationDto): Promise<number> {
    this.logger.log(`📨 Enviando notificación a TODOS los usuarios`);
    
    const userIds = await this.getAllActiveUserIds();
    return this.sendToMultipleUsers(userIds, notification);
  }

  async cleanupExpiredSubscriptions(): Promise<number> {
    this.logger.log(`🧹 Limpiando suscripciones expiradas`);
    
    const activeSubscriptions = await this.subscriptionRepository.find({
      where: { active: true },
    });

    let cleanedCount = 0;
    
    for (const subscription of activeSubscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          JSON.stringify({ title: 'ping', body: 'ping' }),
        );
      } catch (err) {
        const error = err as { statusCode?: number; message?: string };
        if (error.statusCode === 410) {
          await this.subscriptionRepository.update(
            { id: subscription.id },
            { active: false, updatedAt: new Date() },
          );
          cleanedCount++;
          this.logger.log(`🧹 Suscripción expirada limpiada: ${subscription.endpoint.substring(0, 50)}...`);
        }
      }
    }
    
    this.logger.log(`✅ Limpiadas ${cleanedCount} suscripciones expiradas`);
    return cleanedCount;
  }
}