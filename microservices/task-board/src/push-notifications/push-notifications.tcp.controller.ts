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
  async subscribe(@Payload() data: { userId: string; subscription: SubscriptionDto; token?: string }) {
    console.log('📥 [TCP] Recibiendo suscripción para usuario:', data.userId);
    
    try {
      // ✅ Si es token FCM (solo string)
      if (data.token && typeof data.token === 'string') {
        // 🔥 LIMPIAR EL TOKEN: eliminar URL completa si existe
        let cleanToken = data.token;
        if (data.token.startsWith('https://fcm.googleapis.com/fcm/send/')) {
          cleanToken = data.token.replace('https://fcm.googleapis.com/fcm/send/', '');
          console.log(`📥 [TCP] Token limpiado: ${cleanToken.substring(0, 30)}...`);
        }
        
        console.log('📥 [TCP] Token FCM recibido:', cleanToken.substring(0, 30) + '...');
        const result = await this.pushService.subscribeWithToken(data.userId, cleanToken);
        console.log('✅ [TCP] Suscripción FCM guardada:', result.id);
        return result;
      }
      
      // ✅ Si es suscripción web-push (objeto completo)
      if (!data.subscription || !data.subscription.endpoint) {
        throw new Error('Suscripción inválida');
      }
      
      console.log('📥 [TCP] Endpoint:', data.subscription.endpoint.substring(0, 50) + '...');
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