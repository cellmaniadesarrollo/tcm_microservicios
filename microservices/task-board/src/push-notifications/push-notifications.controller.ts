// src/push-notifications/push-notifications.controller.ts
import { Controller, Post, Delete, Body, Param, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service';
import { 
  SubscriptionDto, 
  SendNotificationDto, 
  SendToMultipleDto, 
  UnsubscribeDto,
  SendToBoardDto 
} from './dto/subscription.dto';

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(private readonly pushService: PushNotificationsService) {}

  // ❌ ELIMINAR ESTE ENDPOINT (ya no se usa)
  // @Get('vapid-public-key')
  // async getVapidPublicKey() { ... }

  @Get('health')
  async healthCheck() {
    try {
      const subscriptions = await this.pushService.getActiveSubscriptions();
      return {
        status: 'ok',
        message: 'Push notifications service running',
        activeSubscriptions: subscriptions,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Body('userId') userId: string,
    @Body('subscription') subscription: SubscriptionDto,
  ) {
    try {
      console.log(`📥 [Controller] Recibiendo suscripción para usuario: ${userId}`);
      
      if (!userId) {
        return { success: false, message: 'userId es requerido' };
      }
      if (!subscription || !subscription.endpoint) {
        return { success: false, message: 'Suscripción inválida' };
      }
      
      const result = await this.pushService.subscribe(userId, subscription);
      console.log(`✅ [Controller] Suscripción guardada para usuario: ${userId}`);
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en subscribe:`, error);
      return { success: false, message: error.message || 'Error al suscribir' };
    }
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    try {
      console.log(`📥 [Controller] Desuscribiendo usuario: ${dto.userId}`);
      
      if (!dto.userId || !dto.endpoint) {
        return { success: false, message: 'userId y endpoint son requeridos' };
      }
      
      await this.pushService.unsubscribe(dto.userId, dto.endpoint);
      console.log(`✅ [Controller] Usuario desuscrito: ${dto.userId}`);
      return { success: true, message: 'Suscripción eliminada' };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en unsubscribe:`, error);
      return { success: false, message: error.message || 'Error al desuscribir' };
    }
  }

  @Delete('unsubscribe-all/:userId')
  @HttpCode(HttpStatus.OK)
  async unsubscribeAll(@Param('userId') userId: string) {
    try {
      console.log(`📥 [Controller] Desuscribiendo todas las suscripciones de: ${userId}`);
      const count = await this.pushService.unsubscribeAll(userId);
      console.log(`✅ [Controller] ${count} suscripciones eliminadas para: ${userId}`);
      return { success: true, message: `${count} suscripciones eliminadas` };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en unsubscribeAll:`, error);
      return { success: false, message: error.message || 'Error al desuscribir' };
    }
  }

  @Get('subscriptions/:userId')
  async getUserSubscriptions(@Param('userId') userId: string) {
    try {
      console.log(`📥 [Controller] Obteniendo suscripciones de: ${userId}`);
      const subscriptions = await this.pushService.getUserSubscriptions(userId);
      console.log(`✅ [Controller] ${subscriptions.length} suscripciones encontradas`);
      return { success: true, data: subscriptions };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en getUserSubscriptions:`, error);
      return { success: false, data: [], message: error.message };
    }
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendNotification(@Body() dto: SendNotificationDto) {
    try {
      console.log(`📥 [Controller] Enviando notificación a: ${dto.userId}`);
      
      if (!dto.userId) {
        return { success: false, message: 'userId es requerido' };
      }
      if (!dto.title || !dto.body) {
        return { success: false, message: 'title y body son requeridos' };
      }
      
      const sent = await this.pushService.sendToUser(dto.userId, dto);
      console.log(`✅ [Controller] Notificación enviada a: ${dto.userId} (${sent} dispositivos)`);
      return { success: sent > 0, sentCount: sent };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en sendNotification:`, error);
      return { success: false, message: error.message || 'Error al enviar notificación' };
    }
  }

  @Post('send-to-multiple')
  @HttpCode(HttpStatus.OK)
  async sendToMultiple(@Body() dto: SendToMultipleDto) {
    try {
      console.log(`📥 [Controller] Enviando notificación a ${dto.userIds?.length || 0} usuarios`);
      
      if (!dto.userIds || dto.userIds.length === 0) {
        return { success: false, message: 'userIds es requerido' };
      }
      
      const totalSent = await this.pushService.sendToMultipleUsers(dto.userIds, dto.notification);
      console.log(`✅ [Controller] Notificación enviada a ${totalSent} dispositivos`);
      return { success: true, totalSent, totalUsers: dto.userIds.length };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en sendToMultiple:`, error);
      return { success: false, message: error.message || 'Error al enviar notificaciones' };
    }
  }

  @Post('send-to-board/:boardId')
  @HttpCode(HttpStatus.OK)
  async sendToBoard(
    @Param('boardId') boardId: string,
    @Body() dto: SendToBoardDto,
  ) {
    try {
      console.log(`📥 [Controller] Enviando notificación al board: ${boardId}`);
      
      if (!boardId) {
        return { success: false, message: 'boardId es requerido' };
      }
      
      const memberIds = await this.pushService.getBoardMemberIds(boardId);
      if (memberIds.length === 0) {
        return { success: false, message: 'No se encontraron miembros para este board' };
      }
      
      let targetMembers = memberIds;
      if (dto.excludeUserId) {
        targetMembers = memberIds.filter(id => id !== dto.excludeUserId);
      }
      
      const notification: SendNotificationDto = {
        userId: '',
        title: dto.title,
        body: dto.body,
        icon: dto.icon,
        badge: dto.badge,
        data: { ...dto.data, boardId },
      };
      
      const totalSent = await this.pushService.sendToMultipleUsers(targetMembers, notification);
      
      console.log(`✅ [Controller] Notificación enviada a ${totalSent} dispositivos del board ${boardId}`);
      return { 
        success: true, 
        totalSent, 
        totalMembers: targetMembers.length,
        boardId,
      };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en sendToBoard:`, error);
      return { success: false, message: error.message || 'Error al enviar notificación al board' };
    }
  }

  @Get('stats')
  async getStats() {
    try {
      console.log('📥 [Controller] Obteniendo estadísticas');
      const activeSubscriptions = await this.pushService.getActiveSubscriptions();
      const usersWithSubscriptions = await this.pushService.getUsersWithSubscriptions();
      const allUserIds = await this.pushService.getAllActiveUserIds();
      
      return {
        success: true,
        data: {
          activeSubscriptions,
          usersWithSubscriptions,
          uniqueUsers: allUserIds.length,
          userList: allUserIds,
        },
      };
    } catch (error: any) {
      console.error(`❌ [Controller] Error en getStats:`, error);
      return { success: false, message: error.message };
    }
  }
}