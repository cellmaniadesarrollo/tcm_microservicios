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

  @Get('vapid-public-key')
  async getVapidPublicKey(): Promise<{ publicKey: string }> {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Body('userId') userId: string,
    @Body('subscription') subscription: SubscriptionDto,
  ) {
    if (!userId) {
      return { success: false, message: 'userId es requerido' };
    }
    if (!subscription || !subscription.endpoint) {
      return { success: false, message: 'Suscripción inválida' };
    }
    
    const result = await this.pushService.subscribe(userId, subscription);
    return { success: true, data: result };
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    if (!dto.userId || !dto.endpoint) {
      return { success: false, message: 'userId y endpoint son requeridos' };
    }
    
    await this.pushService.unsubscribe(dto.userId, dto.endpoint);
    return { success: true, message: 'Suscripción eliminada' };
  }

  @Delete('unsubscribe-all/:userId')
  @HttpCode(HttpStatus.OK)
  async unsubscribeAll(@Param('userId') userId: string) {
    const count = await this.pushService.unsubscribeAll(userId);
    return { success: true, message: `${count} suscripciones eliminadas` };
  }

  @Get('subscriptions/:userId')
  async getUserSubscriptions(@Param('userId') userId: string) {
    const subscriptions = await this.pushService.getUserSubscriptions(userId);
    return { success: true, data: subscriptions };
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendNotification(@Body() dto: SendNotificationDto) {
    if (!dto.userId) {
      return { success: false, message: 'userId es requerido' };
    }
    if (!dto.title || !dto.body) {
      return { success: false, message: 'title y body son requeridos' };
    }
    
    const sent = await this.pushService.sendToUser(dto.userId, dto);
    return { success: sent > 0, sentCount: sent };
  }

  @Post('send-to-multiple')
  @HttpCode(HttpStatus.OK)
  async sendToMultiple(@Body() dto: SendToMultipleDto) {
    if (!dto.userIds || dto.userIds.length === 0) {
      return { success: false, message: 'userIds es requerido' };
    }
    
    const totalSent = await this.pushService.sendToMultipleUsers(dto.userIds, dto.notification);
    return { success: true, totalSent, totalUsers: dto.userIds.length };
  }

  @Post('send-to-board/:boardId')
  @HttpCode(HttpStatus.OK)
  async sendToBoard(
    @Param('boardId') boardId: string,
    @Body() dto: SendToBoardDto,
  ) {
    if (!boardId) {
      return { success: false, message: 'boardId es requerido' };
    }
    
    const memberIds = await this.pushService.getBoardMemberIds(boardId);
    if (memberIds.length === 0) {
      return { success: false, message: 'No se encontraron miembros para este board' };
    }
    
    // Filtrar usuario a excluir si es necesario
    let targetMembers = memberIds;
    if (dto.excludeUserId) {
      targetMembers = memberIds.filter(id => id !== dto.excludeUserId);
    }
    
    // ✅ Crear el objeto SendNotificationDto correctamente
    const notification: SendNotificationDto = {
      userId: '', // Este campo se ignora en sendToMultipleUsers porque pasamos userIds
      title: dto.title,
      body: dto.body,
      icon: dto.icon,
      badge: dto.badge,
      data: { ...dto.data, boardId },
    };
    
    const totalSent = await this.pushService.sendToMultipleUsers(targetMembers, notification);
    
    return { 
      success: true, 
      totalSent, 
      totalMembers: targetMembers.length,
      boardId,
    };
  }

  @Get('stats')
  async getStats() {
    const activeSubscriptions = await this.pushService.getActiveSubscriptions();
    const usersWithSubscriptions = await this.pushService.getUsersWithSubscriptions();
    
    return {
      success: true,
      data: {
        activeSubscriptions,
        usersWithSubscriptions,
      },
    };
  }
}