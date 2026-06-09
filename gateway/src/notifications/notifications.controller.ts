// gateway/src/notifications/notifications.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GET /notifications/user/:userId
  @Get('user/:userId')
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('onlyUnread') onlyUnread?: string,
  ) {
    const onlyUnreadBool = onlyUnread === 'true';
    return this.notificationsService.getUserNotifications(userId, page, limit, onlyUnreadBool);
  }

  // 🆕 GET /notifications/user/:userId/unread-count
  @Get('user/:userId/unread-count')
  async getUnreadCount(@Param('userId') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Get('user/:userId/stuck')
  async getCurrentStuckOrders(
    @Param('userId') userId: string,
    @Query('status') status?: string,
    @Query('days') days?: string,  // ← Recibir como string
  ) {
    const daysNum = days !== undefined ? parseInt(days, 10) : 3;  // ← Validar específicamente
    return this.notificationsService.getCurrentStuckOrders(
      userId,
      status || 'INGRESADO',
      daysNum
    );
  }

  // GET /notifications/audit/:entityType/:entityId
  @Get('audit/:entityType/:entityId')
  async getAuditHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.notificationsService.getAuditHistory(entityType, entityId, companyId);
  }

  // PATCH /notifications/:id/read
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string, 
    @Body('userId') userId: string,
    @Body('userName') userName?: string
  ) {
    return this.notificationsService.markAsRead(id, userId, userName);
  }

  // POST /notifications/:id/track-access
  @Post(':id/track-access')
  async trackAccess(
    @Param('id') id: string,
    @Body() body: { userId: string; actionData: any },
  ) {
    return this.notificationsService.trackAccess(id, body.userId, body.actionData);
  }

    // ============================================
  // ✅ NUEVOS ENDPOINTS PARA OBSERVACIONES Y PROGRAMACIÓN
  // ============================================

  // PATCH /notifications/:id/observations
  @Patch(':id/observations')
  async updateObservations(
    @Param('id') id: string,
    @Body('observations') observations: string,
  ) {
    return this.notificationsService.updateObservations(id, observations);
  }

  // PATCH /notifications/:id/reschedule
  @Patch(':id/reschedule')
  async rescheduleNotification(
    @Param('id') id: string,
    @Body('scheduledFor') scheduledFor: Date,
    @Body('observations') observations?: string,
  ) {
    return this.notificationsService.rescheduleNotification(id, scheduledFor, observations);
  }

  // PATCH /notifications/:id/cancel-scheduling
  @Patch(':id/cancel-scheduling')
  async cancelScheduling(@Param('id') id: string) {
    return this.notificationsService.cancelScheduling(id);
  }

  // GET /notifications/scheduled/pending
  @Get('scheduled/pending')
  async getScheduledNotifications(@Query('currentDate') currentDate?: string) {
    const date = currentDate ? new Date(currentDate) : new Date();
    return this.notificationsService.getScheduledNotifications(date);
  }

  // GET /notifications/scheduled/future
  @Get('scheduled/future')
  async getFutureNotifications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getFutureNotifications(page, limit);
  }

  @Get('delivered')
  async getDeliveredNotifications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getDeliveredNotifications(page, limit);
  }

  @Get('finished/three-months')
  async getFinishedOrdersOverThreeMonths(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getFinishedOrdersOverThreeMonths(page, limit);
  }
}