// ms-task-board/src/push-notifications/push-notifications.tcp.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PushNotificationsService } from './push-notifications.service';
import { SubscriptionDto } from './dto/subscription.dto';

@Controller()
export class PushNotificationsTcpController {
  constructor(private readonly pushService: PushNotificationsService) {}

  // ❌ ELIMINAR ESTE HANDLER (ya no se usa)
  // @MessagePattern({ cmd: 'push-notifications.vapid-public-key' })
  // async getVapidPublicKey() { ... }

  @MessagePattern({ cmd: 'push-notifications.subscribe' })
  async subscribe(@Payload() data: { userId: string; subscription: SubscriptionDto }) {
    console.log('📥 [TCP] Recibiendo suscripción para usuario:', data.userId);
    console.log('📥 [TCP] Endpoint:', data.subscription?.endpoint?.substring(0, 50) + '...');
    
    try {
      const result = await this.pushService.subscribe(data.userId, data.subscription);
      console.log('✅ [TCP] Suscripción guardada:', result.id);
      return result;
    } catch (error) {
      console.error('❌ [TCP] Error guardando suscripción:', error);
      throw error;
    }
  }

  @MessagePattern({ cmd: 'push-notifications.unsubscribe' })
  async unsubscribe(@Payload() data: { userId: string; endpoint: string }) {
    console.log('📥 [TCP] Desuscribiendo usuario:', data.userId);
    await this.pushService.unsubscribe(data.userId, data.endpoint);
    return { success: true };
  }

  @MessagePattern({ cmd: 'push-notifications.user-subscriptions' })
  async getUserSubscriptions(@Payload() data: { userId: string }) {
    console.log('📥 [TCP] Obteniendo suscripciones de usuario:', data.userId);
    return this.pushService.getUserSubscriptions(data.userId);
  }

  @MessagePattern({ cmd: 'push-notifications.send-to-user' })
  async sendToUser(@Payload() data: { userId: string; title: string; body: string; data?: any }) {
    console.log('📥 [TCP] Enviando notificación a usuario:', data.userId);
    return this.pushService.sendToUser(data.userId, {
      userId: data.userId,
      title: data.title,
      body: data.body,
      data: data.data || {},
    });
  }

  @MessagePattern({ cmd: 'push-notifications.send-to-board' })
  async sendToBoard(@Payload() data: { boardId: string; title: string; body: string; excludeUserId?: string; data?: any }) {
    console.log('📥 [TCP] Enviando notificación a board:', data.boardId);
    return this.pushService.sendToBoardMembers(
      data.boardId,
      {
        title: data.title,
        body: data.body,
        data: data.data || {},
      },
      data.excludeUserId,
    );
  }
}