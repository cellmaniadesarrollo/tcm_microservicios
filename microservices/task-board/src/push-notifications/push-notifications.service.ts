// src/push-notifications/push-notifications.service.ts
import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { PushSubscription } from './entities/push-subscription.entity';
import { SubscriptionDto, SendNotificationDto } from './dto/subscription.dto';
import { BoardsService } from '../boards/boards.service';

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private fcm: admin.messaging.Messaging | null = null;
  private firebaseInitialized = false;

  constructor(
    @InjectRepository(PushSubscription)
    private subscriptionRepository: Repository<PushSubscription>,
    @Inject(forwardRef(() => BoardsService))
    private boardsService: BoardsService,
  ) {}

  // ==================== 🔥 FIREBASE INIT ====================

  async onModuleInit() {
    await this.initFirebase();
  }

  private async initFirebase() {
    try {
      if (admin.apps.length > 0) {
        this.fcm = admin.messaging();
        this.firebaseInitialized = true;
        this.logger.log('✅ Firebase ya inicializado');
        return;
      }

      if (process.env.FIREBASE_PROJECT_ID && 
          process.env.FIREBASE_PRIVATE_KEY && 
          process.env.FIREBASE_CLIENT_EMAIL) {
        
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: privateKey,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        });
        this.fcm = admin.messaging();
        this.firebaseInitialized = true;
        this.logger.log('✅ Firebase inicializado con variables de entorno');
        return;
      }

      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        this.fcm = admin.messaging();
        this.firebaseInitialized = true;
        this.logger.log('✅ Firebase inicializado con APPLICATION_DEFAULT');
        return;
      }

      this.logger.warn('⚠️ No se encontraron credenciales de Firebase.');
      
    } catch (error) {
      this.logger.error('❌ Error inicializando Firebase:', error);
      this.firebaseInitialized = false;
    }
  }

  // ==================== 📱 SUSCRIPCIONES ====================

  async subscribe(userId: string, subscription: SubscriptionDto): Promise<PushSubscription> {
    this.logger.log(`📱 Suscribiendo usuario ${userId}`);

    const existing = await this.subscriptionRepository.findOne({
      where: { userId, endpoint: subscription.endpoint },
    });

    if (existing) {
      existing.keys = subscription.keys;
      existing.expirationTime = subscription.expirationTime ?? null;
      existing.active = true;
      existing.updatedAt = new Date();
      await this.subscriptionRepository.save(existing);
      this.logger.log(`✅ Suscripción actualizada`);
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
    this.logger.log(`✅ Nueva suscripción guardada`);
    return newSubscription;
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    this.logger.log(`❌ Desactivando suscripción`);
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

  async subscribeWithToken(userId: string, token: string): Promise<PushSubscription> {
    this.logger.log(`📱 Suscribiendo usuario ${userId} con token FCM`);

    // ✅ LIMPIAR EL TOKEN por si acaso
    let cleanToken = token;
    if (token && token.startsWith('https://fcm.googleapis.com/fcm/send/')) {
      cleanToken = token.replace('https://fcm.googleapis.com/fcm/send/', '');
      this.logger.log(`📤 Token limpiado (URL eliminada): ${cleanToken.substring(0, 30)}...`);
    }

    // Buscar si ya existe
    const existing = await this.subscriptionRepository.findOne({
      where: { userId, endpoint: cleanToken },
    });

    if (existing) {
      existing.active = true;
      existing.updatedAt = new Date();
      await this.subscriptionRepository.save(existing);
      this.logger.log(`✅ Suscripción actualizada`);
      return existing;
    }

    // Crear nueva suscripción con el token limpio
    const newSubscription = new PushSubscription();
    newSubscription.userId = userId;
    newSubscription.endpoint = cleanToken;  // ✅ SOLO EL TOKEN
    newSubscription.keys = { p256dh: '', auth: '' };
    newSubscription.active = true;
    newSubscription.createdAt = new Date();
    newSubscription.updatedAt = new Date();

    await this.subscriptionRepository.save(newSubscription);
    this.logger.log(`✅ Nueva suscripción FCM guardada`);
    return newSubscription;
  }

  // ==================== 🔥 ENVÍO DE NOTIFICACIONES ====================

  async sendToUser(userId: string, notification: SendNotificationDto): Promise<number> {
    this.logger.log(`📨 Enviando notificación a usuario ${userId}: ${notification.title}`);

    if (!this.firebaseInitialized || !this.fcm) {
      this.logger.error('❌ Firebase no inicializado.');
      return 0;
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: { userId, active: true },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(`⚠️ Usuario ${userId} no tiene suscripciones activas`);
      return 0;
    }

    let sentCount = 0;

    for (const subscription of subscriptions) {
      try {
        let token = subscription.endpoint;
        
        // ✅ Si es una URL completa de FCM, extraer solo el token
        if (token && token.startsWith('https://fcm.googleapis.com/fcm/send/')) {
          token = token.replace('https://fcm.googleapis.com/fcm/send/', '');
          this.logger.log(`📤 Token extraído de URL: ${token.substring(0, 20)}...`);
        }
        
        // ✅ Validar que el token es válido
        if (!token || token.startsWith('https://')) {
          this.logger.warn(`⚠️ Token inválido: ${token?.substring(0, 30)}...`);
          continue;
        }

        this.logger.log(`📤 Enviando con token: ${token.substring(0, 20)}...`);

        const message: admin.messaging.Message = {
          notification: {
            title: notification.title,
            body: notification.body,
            imageUrl: notification.icon || undefined,
          },
          data: {
            ...notification.data,
            type: 'notification',
            timestamp: Date.now().toString(),
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                contentAvailable: true,
              },
            },
          },
          token: token,
        };

        const response = await this.fcm.send(message);
        sentCount++;
        this.logger.log(`✅ Notificación Firebase enviada: ${response}`);

      } catch (error: any) {
        const errorCode = error?.code || 'unknown';
        this.logger.error(`❌ Error Firebase: ${errorCode}`);

        if (errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token') {
          await this.subscriptionRepository.update(
            { id: subscription.id },
            { active: false, updatedAt: new Date() },
          );
          this.logger.warn(`⚠️ Token FCM expirado, desactivado`);
        }
      }
    }

    return sentCount;
  }

  async sendToMultipleUsers(userIds: string[], notification: SendNotificationDto): Promise<number> {
    this.logger.log(`📨 Enviando a ${userIds.length} usuarios`);
    
    let totalSent = 0;
    for (const userId of userIds) {
      totalSent += await this.sendToUser(userId, notification);
    }
    
    return totalSent;
  }

  async sendToAllExcept(excludeUserId: string, notification: SendNotificationDto): Promise<number> {
    this.logger.log(`📨 Enviando a todos excepto ${excludeUserId}`);
    const userIds = await this.getAllActiveUserIds();
    const filteredUserIds = userIds.filter(id => id !== excludeUserId);
    return this.sendToMultipleUsers(filteredUserIds, notification);
  }

  async sendToAll(notification: SendNotificationDto): Promise<number> {
    this.logger.log(`📨 Enviando a TODOS los usuarios`);
    const userIds = await this.getAllActiveUserIds();
    return this.sendToMultipleUsers(userIds, notification);
  }

  // ==================== MÉTODOS DE BOARDS ====================

  async getBoardMemberIds(boardId: string): Promise<string[]> {
    this.logger.log(`🔍 Buscando miembros del board ${boardId}`);
    
    try {
      const members = await this.boardsService.getMembers(boardId);
      return members.map(member => member.userId);
    } catch (error) {
      this.logger.error(`❌ Error obteniendo miembros: ${error}`);
      return [];
    }
  }

  async sendToBoardMembers(
    boardId: string,
    notification: Omit<SendNotificationDto, 'userId'>,
    excludeUserId?: string,
  ): Promise<number> {
    this.logger.log(`📨 Enviando a miembros del board ${boardId}`);
    
    const memberIds = await this.getBoardMemberIds(boardId);
    if (memberIds.length === 0) {
      this.logger.warn(`⚠️ No hay miembros`);
      return 0;
    }
    
    let targetMembers = memberIds;
    if (excludeUserId) {
      targetMembers = memberIds.filter(id => id !== excludeUserId);
    }
    
    if (targetMembers.length === 0) {
      this.logger.warn(`⚠️ No hay miembros para notificar`);
      return 0;
    }
    
    const fullNotification: SendNotificationDto = {
      userId: '',
      title: notification.title,
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      data: { ...notification.data, boardId },
    };
    
    return this.sendToMultipleUsers(targetMembers, fullNotification);
  }

  async cleanupExpiredSubscriptions(): Promise<number> {
    this.logger.log(`🧹 Limpiando suscripciones expiradas`);
    
    const activeSubscriptions = await this.subscriptionRepository.find({
      where: { active: true },
    });

    let cleanedCount = 0;
    
    for (const subscription of activeSubscriptions) {
      try {
        await this.fcm?.send({
          token: subscription.endpoint,
          data: { ping: 'true' },
        }, true);
      } catch (error: any) {
        const errorCode = error?.code || 'unknown';
        if (errorCode === 'messaging/registration-token-not-registered') {
          await this.subscriptionRepository.update(
            { id: subscription.id },
            { active: false, updatedAt: new Date() },
          );
          cleanedCount++;
          this.logger.log(`🧹 Token FCM expirado limpiado`);
        }
      }
    }
    
    return cleanedCount;
  }
}