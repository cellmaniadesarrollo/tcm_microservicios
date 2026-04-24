// gateway/src/notifications/notifications.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
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
  ) {
    return this.notificationsService.getUserNotifications(userId, page, limit);
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
  async markAsRead(@Param('id') id: string, @Body('userId') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  // POST /notifications/:id/track-access
  @Post(':id/track-access')
  async trackAccess(
    @Param('id') id: string,
    @Body() body: { userId: string; actionData: any },
  ) {
    return this.notificationsService.trackAccess(id, body.userId, body.actionData);
  }
}