// gateway/src/notifications/notifications.controller.ts
import { Controller, Get, Post, Patch, Delete, Put, Param, Body, Query, BadRequestException } from '@nestjs/common';
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
    @Query('days') days?: string,
  ) {
    const daysNum = days !== undefined ? parseInt(days, 10) : 3;
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
    @Query('includeArchived') includeArchived?: string,
    @Query('onlyWithNotes') onlyWithNotes?: string,
  ) {
    const includeArchivedBool = includeArchived === 'true';
    const onlyWithNotesBool = onlyWithNotes === 'true';
    return this.notificationsService.getDeliveredNotifications(
      page,
      limit,
      includeArchivedBool,
      onlyWithNotesBool
    );
  }

  @Get('finished/three-months')
  async getFinishedOrdersOverThreeMonths(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('includeArchived') includeArchived?: string,
    @Query('onlyWithNotes') onlyWithNotes?: string,
  ) {
    const includeArchivedBool = includeArchived === 'true';
    const onlyWithNotesBool = onlyWithNotes === 'true';
    return this.notificationsService.getFinishedOrdersOverThreeMonths(
      page,
      limit,
      includeArchivedBool,
      onlyWithNotesBool
    );
  }

  @Patch(':id/notes')
  async updateNotificationNotes(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('notes') notes: string,
  ) {
    return this.notificationsService.updateNotificationNotes(id, userId, notes);
  }

  @Patch(':id/archive')
  async archiveNotification(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('archived') archived: boolean,
  ) {
    return this.notificationsService.archiveNotification(id, userId, archived);
  }

  @Get('delivered/reviewed')
  async getReviewedDeliveredOrders(
    @Query('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!userId) {
      throw new BadRequestException('userId es requerido');
    }
    return this.notificationsService.getReviewedDeliveredOrders(userId, page, limit);
  }

  @Post('observations')
  async createOrderObservation(
    @Body('orderId') orderId: string,
    @Body('userId') userId: string,
    @Body('userName') userName: string,
    @Body('observation') observation: string,
  ) {
    if (!orderId || !userId || !observation) {
      throw new BadRequestException('orderId, userId y observation son requeridos');
    }
    return this.notificationsService.createOrderObservation({
      orderId,
      userId,
      userName: userName || userId,
      observation,
    });
  }

  @Get('observations/order/:orderId')
  async getOrderObservations(
    @Param('orderId') orderId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!orderId) {
      throw new BadRequestException('orderId es requerido');
    }
    return this.notificationsService.getOrderObservations(orderId, page, limit);
  }

  @Get('observations/user/:userId')
  async getUserObservations(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!userId) {
      throw new BadRequestException('userId es requerido');
    }
    return this.notificationsService.getUserObservations(userId, page, limit);
  }

  @Patch('observations/:id')
  async updateOrderObservation(
    @Param('id') id: string,
    @Body('observation') observation: string,
  ) {
    if (!id) {
      throw new BadRequestException('id es requerido');
    }
    if (!observation) {
      throw new BadRequestException('observation es requerido');
    }
    return this.notificationsService.updateOrderObservation(id, observation);
  }

  @Delete('observations/:id')
  async deleteOrderObservation(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('id es requerido');
    }
    return this.notificationsService.deleteOrderObservation(id);
  }

  @Delete('observations/order/:orderId')
  async deleteOrderObservationsByOrder(@Param('orderId') orderId: string) {
    if (!orderId) {
      throw new BadRequestException('orderId es requerido');
    }
    return this.notificationsService.deleteOrderObservationsByOrder(orderId);
  }

  /**
   * POST /notifications/tracking
   * Crear tracking para una notificación
   */
  @Post('tracking')
  async createNotificationTracking(
    @Body() body: {
      notificationId: string;
      notes?: string;
      isCalled?: boolean;
      hasProblems?: boolean;
      problemDescription?: string;
      calledBy?: string;
      calledByName?: string;
      problemReportedBy?: string;
      problemReportedByName?: string;
      archivedBy?: string;
      archivedByName?: string;
      doesNotApply?: boolean;        // 👈 CAMPO AGREGADO
      doesNotApplyAt?: Date;          // 👈 CAMPO AGREGADO
      doesNotApplyBy?: string;        // 👈 CAMPO AGREGADO
    }
  ) {
    if (!body.notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    return this.notificationsService.createNotificationTracking(body);
  }

  /**
   * GET /notifications/tracking/notification/:notificationId
   * Obtener historial completo de tracking
   */
  @Get('tracking/notification/:notificationId')
  async getNotificationTrackingHistory(@Param('notificationId') notificationId: string) {
    if (!notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    return this.notificationsService.getNotificationTrackingHistory(notificationId);
  }

  /**
   * GET /notifications/tracking/notification/:notificationId/latest
   * Obtener el tracking más reciente
   */
  @Get('tracking/notification/:notificationId/latest')
  async getLatestNotificationTracking(@Param('notificationId') notificationId: string) {
    if (!notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    return this.notificationsService.getLatestNotificationTracking(notificationId);
  }

  /**
   * PUT /notifications/tracking/:id
   * Actualizar tracking existente
   */
  @Put('tracking/:id')
  async updateNotificationTracking(
    @Param('id') id: string,
    @Body() body: {
      notes?: string;
      isCalled?: boolean;
      hasProblems?: boolean;
      problemDescription?: string;
      calledBy?: string;
      calledByName?: string;
      problemReportedBy?: string;
      problemReportedByName?: string;
      archivedBy?: string;
      archivedByName?: string;
      isArchived?: boolean;
      unarchivedBy?: string;
      unarchivedByName?: string;
      doesNotApply?: boolean;        // 👈 CAMPO AGREGADO
      doesNotApplyAt?: Date;          // 👈 CAMPO AGREGADO
      doesNotApplyBy?: string;        // 👈 CAMPO AGREGADO
    }
  ) {
    if (!id) {
      throw new BadRequestException('id es requerido');
    }
    return this.notificationsService.updateNotificationTracking(id, body);
  }

  /**
   * POST /notifications/tracking/notification/:notificationId/call
   * Marcar como llamada realizada
   */
  @Post('tracking/notification/:notificationId/call')
  async markAsCalled(
    @Param('notificationId') notificationId: string,
    @Body() body: {
      userId: string;
      userName: string;
      notes?: string;
    }
  ) {
    if (!notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    if (!body.userId || !body.userName) {
      throw new BadRequestException('userId y userName son requeridos');
    }
    return this.notificationsService.markAsCalled(
      notificationId,
      body.userId,
      body.userName,
      body.notes
    );
  }

  /**
   * POST /notifications/tracking/notification/:notificationId/problem
   * Reportar problema
   */
  @Post('tracking/notification/:notificationId/problem')
  async reportProblem(
    @Param('notificationId') notificationId: string,
    @Body() body: {
      userId: string;
      userName: string;
      problemDescription: string;
      notes?: string;
    }
  ) {
    if (!notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    if (!body.userId || !body.userName || !body.problemDescription) {
      throw new BadRequestException('userId, userName y problemDescription son requeridos');
    }
    return this.notificationsService.reportProblem(
      notificationId,
      body.userId,
      body.userName,
      body.problemDescription,
      body.notes
    );
  }

  /**
   * 👈 NUEVO ENDPOINT: POST /notifications/tracking/notification/:notificationId/does-not-apply
   * Marcar como No Aplica
   */
  @Post('tracking/notification/:notificationId/does-not-apply')
  async markAsDoesNotApply(
    @Param('notificationId') notificationId: string,
    @Body() body: {
      userId: string;
    }
  ) {
    if (!notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    if (!body.userId) {
      throw new BadRequestException('userId es requerido');
    }
    return this.notificationsService.markAsDoesNotApply(
      notificationId,
      body.userId
    );
  }

  /**
   * POST /notifications/tracking/notification/:notificationId/archive
   * Archivar/Desarchivar
   */
  @Post('tracking/notification/:notificationId/archive')
  async toggleArchive(
    @Param('notificationId') notificationId: string,
    @Body() body: {
      userId: string;
      userName: string;
      archive: boolean;
    }
  ) {
    if (!notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    if (!body.userId || !body.userName) {
      throw new BadRequestException('userId y userName son requeridos');
    }
    if (body.archive === undefined || body.archive === null) {
      throw new BadRequestException('archive es requerido (true/false)');
    }
    return this.notificationsService.toggleArchive(
      notificationId,
      body.userId,
      body.userName,
      body.archive
    );
  }

  /**
   * POST /notifications/tracking/notification/:notificationId/note
   * Agregar nota
   */
  @Post('tracking/notification/:notificationId/note')
  async addNoteToNotification(
    @Param('notificationId') notificationId: string,
    @Body() body: {
      userId: string;
      userName: string;
      notes: string;
    }
  ) {
    if (!notificationId) {
      throw new BadRequestException('notificationId es requerido');
    }
    if (!body.userId || !body.userName || !body.notes) {
      throw new BadRequestException('userId, userName y notes son requeridos');
    }
    return this.notificationsService.addNoteToNotification(
      notificationId,
      body.userId,
      body.userName,
      body.notes
    );
  }

  /**
   * DELETE /notifications/tracking/:id
   * Eliminar tracking (administración)
   */
  @Delete('tracking/:id')
  async deleteNotificationTracking(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('id es requerido');
    }
    return this.notificationsService.deleteNotificationTracking(id);
  }
}