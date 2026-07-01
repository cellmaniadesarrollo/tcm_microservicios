// gateway/src/taskboard/taskboard.controller.ts
import { Controller, Post, Body, Get, Put, Param, Res, Patch, Delete, Query, UploadedFile, UseInterceptors, Redirect } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TaskboardService } from './taskboard.service';
import { Response } from 'express';

@Controller('taskboard')
export class TaskboardController {
  constructor(private readonly taskboardService: TaskboardService) {}

  // ========== USERS (para buscar miembros) ==========
  
  @Get('users')
  async getAllUsers() {
    return this.taskboardService.getAllUsers();
  }

  @Get('users/search')
  async searchUsers(@Query('q') search: string) {
    return this.taskboardService.searchUsers(search);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.taskboardService.getUserById(id);
  }

  // ========== RUTAS ESPECÍFICAS PRIMERO ==========
  
  @Get('boards/roles')
  getRoles() {
    return this.taskboardService.getRoles();
  }

  @Post('boards/roles')
  createRole(@Body() data: any) {
    return this.taskboardService.createRole(data);
  }

  @Get('boards/user/:userId')
  findBoardsByUser(@Param('userId') userId: string) {
    return this.taskboardService.findBoardsByUser(userId);
  }

  // ========== RUTAS DINÁMICAS DESPUÉS ==========
  
  @Post('boards')
  createBoard(@Body() data: any) {
    return this.taskboardService.createBoard(data);
  }

  @Get('boards')
  findAllBoards() {
    return this.taskboardService.findAllBoards();
  }

  @Get('boards/:id')
  findOneBoard(@Param('id') id: string) {
    return this.taskboardService.findOneBoard(id);
  }

  @Patch('boards/:id')
  updateBoard(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.updateBoard(id, data);
  }

  @Delete('boards/:id')
  removeBoard(@Param('id') id: string) {
    return this.taskboardService.removeBoard(id);
  }

  @Get('boards/:id/members')
  async getBoardMembers(@Param('id') id: string) {
    return this.taskboardService.getBoardMembersWithDetails(id);
  }

  @Post('boards/:id/members/:userId')
  addMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.taskboardService.addMember(id, userId);
  }

  @Delete('boards/:id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.taskboardService.removeMember(id, userId);
  }

  @Patch('boards/:id/members/:userId/role')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() data: { roleName: string }
  ) {
    return this.taskboardService.updateMemberRole(id, userId, data);
  }

  // ========== INVITACIONES ==========

  @Post('boards/:id/invitations')
  async inviteMember(
    @Param('id') id: string,
    @Body() data: { userId: string; roleName: string; expiresInDays?: number }
  ) {
    return this.taskboardService.inviteMember(id, data);
  }

  @Post('invitations/:invitationId/accept')
  async acceptInvitation(@Param('invitationId') invitationId: string) {
    return this.taskboardService.acceptInvitation(invitationId);
  }

  @Get('invitations/pending')
  async getPendingInvitations(@Query('userId') userId: string) {
    return this.taskboardService.getPendingInvitations(userId);
  }

  // ========== TASKS ==========
  
  @Post('tasks')
  createTask(@Body() data: any) {
    return this.taskboardService.createTask(data);
  }

  @Get('tasks')
  findAllTasks() {
    return this.taskboardService.findAllTasks();
  }

  @Get('tasks/board/:boardId')
  findTasksByBoard(@Param('boardId') boardId: string) {
    return this.taskboardService.findTasksByBoard(boardId);
  }

  @Get('tasks/user/:userId')
  findTasksByUser(@Param('userId') userId: string) {
    return this.taskboardService.findTasksByUser(userId);
  }

  @Get('tasks/:id')
  findOneTask(@Param('id') id: string) {
    return this.taskboardService.findOneTask(id);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.updateTask(id, data);
  }

  @Delete('tasks/:id')
  removeTask(@Param('id') id: string) {
    return this.taskboardService.removeTask(id);
  }

  // ========== IMÁGENES (AGREGAR AQUÍ) ==========
  
  @Post('tasks/:taskId/images')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('taskId') taskId: string,
    @UploadedFile() file: any, 
    @Body('taskDetailId') taskDetailId?: string
  ) {
    console.log('🔥🔥🔥 CONTROLLER uploadImage llamado 🔥🔥🔥');
    console.log('taskId:', taskId);
    console.log('file:', file ? 'RECIBIDO' : 'NO RECIBIDO');
    console.log('file.originalname:', file?.originalname);
    console.log('file.size:', file?.size);
    
    // Por ahora, devolver mock
    return {
      success: true,
      message: 'Prueba - imagen recibida',
      data: { taskId, fileName: file?.originalname }
    };
  }

  @Post('tasks/:taskId/images/base64')
  async uploadImageBase64(
    @Param('taskId') taskId: string,
    @Body() body: { file: string; originalName: string; mimeType: string; taskDetailId?: string }
  ) {
    console.log('🔥 Recibida imagen base64 para tarea:', taskId);
    console.log('  - originalName:', body.originalName);
    console.log('  - mimeType:', body.mimeType);
    console.log('  - base64 length:', body.file.length);
    
    return this.taskboardService.uploadImageBase64(taskId, body);
  }

  @Get('tasks/:taskId/images')
  async getTaskImages(@Param('taskId') taskId: string) {
    return this.taskboardService.getTaskImages(taskId);
  }

  @Get('tasks/:taskId/images/detail/:taskDetailId')
  async getTaskDetailImages(
    @Param('taskId') taskId: string,
    @Param('taskDetailId') taskDetailId: string
  ) {
    return this.taskboardService.getTaskDetailImages(taskId, taskDetailId);
  }

  @Get('tasks/:taskId/images/:imageId/url')
  async getImageUrl(
    @Param('taskId') taskId: string,
    @Param('imageId') imageId: string
  ) {
    return this.taskboardService.getImageUrl(taskId, imageId);
  }

  @Delete('tasks/:taskId/images/:imageId')
  async deleteImage(
    @Param('taskId') taskId: string,
    @Param('imageId') imageId: string
  ) {
    return this.taskboardService.deleteImage(taskId, imageId);
  }

  // ========== COMENTARIOS ==========

  @Get('tasks/:id/comments')
  async getTaskComments(@Param('id') id: string) {
    return this.taskboardService.getTaskComments(id);
  }

  @Post('tasks/:id/comments')
  async createComment(
    @Param('id') id: string,
    @Body() data: { content: string; userId: string; parentCommentId?: string }
  ) {
    return this.taskboardService.createComment(id, data);
  }

  @Patch('tasks/comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() data: { content: string }
  ) {
    return this.taskboardService.updateComment(commentId, data);
  }

  @Delete('tasks/comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string) {
    return this.taskboardService.deleteComment(commentId);
  }

  // ========== SUBTAREAS ==========

  @Get('tasks/:id/subtasks')
  async getTaskSubtasks(@Param('id') id: string) {
    return this.taskboardService.getTaskSubtasks(id);
  }

  @Post('tasks/:id/subtasks')
  async createSubtask(
    @Param('id') id: string,
    @Body() data: { title: string; description?: string; assignedTo?: string; dueDate?: string }
  ) {
    return this.taskboardService.createSubtask(id, data);
  }

  @Patch('tasks/subtasks/:subtaskId')
  async updateSubtask(
    @Param('subtaskId') subtaskId: string,
    @Body() data: any
  ) {
    return this.taskboardService.updateSubtask(subtaskId, data);
  }

  @Patch('tasks/subtasks/:subtaskId/status')
  async updateSubtaskStatus(
    @Param('subtaskId') subtaskId: string,
    @Body() data: { status: string }
  ) {
    return this.taskboardService.updateSubtaskStatus(subtaskId, data.status);
  }

  @Delete('tasks/subtasks/:subtaskId')
  async deleteSubtask(@Param('subtaskId') subtaskId: string) {
    return this.taskboardService.deleteSubtask(subtaskId);
  }

  // ========== COLUMNAS ==========
  
  @Get('boards/:id/columns')
  async getColumns(@Param('id') id: string) {
    return this.taskboardService.getColumns(id);
  }

  @Post('boards/:id/columns')
  async createColumn(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.createColumn(id, data);
  }

  @Patch('boards/columns/:columnId')
  async updateColumn(@Param('columnId') columnId: string, @Body() data: any) {
    return this.taskboardService.updateColumn(columnId, data);
  }

  @Delete('boards/columns/:columnId')
  async deleteColumn(@Param('columnId') columnId: string) {
    return this.taskboardService.deleteColumn(columnId);
  }

  @Post('boards/:id/setup-default-columns')
  async setupDefaultColumns(@Param('id') id: string) {
    return this.taskboardService.setupDefaultColumns(id);
  }

  @Post('boards/:id/reorder-columns')
  async reorderColumns(@Param('id') id: string, @Body('columnIds') columnIds: string[]) {
    return this.taskboardService.reorderColumns(columnIds);
  }

  @Post('boards/:id/move-task')
  async moveTask(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.moveTask(id, data);
  }

  @Post('boards/columns/:columnId/tasks/:taskId')
  async addTaskToColumn(
    @Param('columnId') columnId: string,
    @Param('taskId') taskId: string
  ) {
    return this.taskboardService.addTaskToColumn(columnId, taskId);
  }

  @Delete('boards/columns/:columnId/tasks/:taskId')
  async removeTaskFromColumn(
    @Param('columnId') columnId: string,
    @Param('taskId') taskId: string
  ) {
    return this.taskboardService.removeTaskFromColumn(columnId, taskId);
  }

  // ========== COLABORADORES ==========
  
  @Post('tasks/:id/collaborators/:userId')
  addCollaborator(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('addedBy') addedBy: string
  ) {
    return this.taskboardService.addCollaborator(id, userId, addedBy || userId);
  }

  @Get('tasks/:id/collaborators')
  getCollaborators(@Param('id') id: string) {
    return this.taskboardService.getCollaborators(id);
  }

  @Delete('tasks/:id/collaborators/:userId')
  removeCollaborator(@Param('id') id: string, @Param('userId') userId: string) {
    return this.taskboardService.removeCollaborator(id, userId);
  }

  // ========== LABELS ==========
  
  @Post('labels')
  createLabel(@Body() data: any) {
    return this.taskboardService.createLabel(data);
  }

  @Get('labels')
  findAllLabels() {
    return this.taskboardService.findAllLabels();
  }

  @Get('labels/board/:boardId')
  findLabelsByBoard(@Param('boardId') boardId: string) {
    return this.taskboardService.findLabelsByBoard(boardId);
  }

  @Get('labels/:id')
  findOneLabel(@Param('id') id: string) {
    return this.taskboardService.findOneLabel(id);
  }

  @Patch('labels/:id')
  updateLabel(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.updateLabel(id, data);
  }

  @Delete('labels/:id')
  removeLabel(@Param('id') id: string) {
    return this.taskboardService.removeLabel(id);
  }

    // ========== PUSH NOTIFICATIONS ==========

  @Get('push-notifications/vapid-public-key')
  async getVapidPublicKey() {
    return this.taskboardService.getVapidPublicKey();
  }

  @Post('push-notifications/subscribe')
  async subscribeToPush(
    @Body('userId') userId: string,
    @Body('subscription') subscription: any,
  ) {
    if (!userId) {
      return { success: false, message: 'userId es requerido' };
    }
    if (!subscription || !subscription.endpoint) {
      return { success: false, message: 'Suscripción inválida' };
    }
    return this.taskboardService.subscribeToPush(userId, subscription);
  }

  @Delete('push-notifications/unsubscribe')
  async unsubscribeFromPush(
    @Body('userId') userId: string,
    @Body('endpoint') endpoint: string,
  ) {
    if (!userId || !endpoint) {
      return { success: false, message: 'userId y endpoint son requeridos' };
    }
    return this.taskboardService.unsubscribeFromPush(userId, endpoint);
  }

  @Get('push-notifications/subscriptions/:userId')
  async getUserPushSubscriptions(@Param('userId') userId: string) {
    return this.taskboardService.getUserPushSubscriptions(userId);
  }

  // ========== CALENDAR / TAREAS DE LIMPIEZA ==========

  @Post('calendar/tasks')
  async createCalendarTask(@Body() data: any) {
    return this.taskboardService.createCalendarTask(data);
  }

  @Get('calendar/users/:userId/tasks')
  async getUserCalendarTasks(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    return this.taskboardService.getUserCalendarTasks(userId, currentYear, currentMonth);
  }

  @Get('calendar/monthly-tasks')
  async getAllCalendarTasksForMonth(
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('userId') userId?: string,
  ) {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    return this.taskboardService.getAllCalendarTasksForMonth(currentYear, currentMonth, userId);
  }

  @Put('calendar/tasks/:id')
  async updateCalendarTask( 
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.taskboardService.updateCalendarTask(id, data);
  }

  @Delete('calendar/tasks/:id')
  async deleteCalendarTask(@Param('id') id: string) {
    return this.taskboardService.deleteCalendarTask(id);
  }

  @Put('calendar/tasks/:id/toggle')
  async toggleCalendarTaskComplete(@Param('id') id: string) {
    return this.taskboardService.toggleCalendarTaskComplete(id);
  }

  @Put('calendar/tasks/:id/complete')
  async completeCalendarTaskWithPhoto(
    @Param('id') id: string,
    @Body() data: { completionPhotoUrl: string; completionNotes?: string },
  ) {
    return this.taskboardService.completeCalendarTaskWithPhoto(id, data);
  }

  @Get('calendar/users/:userId/tasks/today')
  async getTodayCalendarTasks(@Param('userId') userId: string) {
    return this.taskboardService.getTodayCalendarTasks(userId);
  }

  @Get('calendar/users/:userId/tasks/pending')
  async getPendingCalendarTasks(@Param('userId') userId: string) {
    return this.taskboardService.getPendingCalendarTasks(userId);
  }

  @Get('calendar/users/:userId/report')
  async getUserCalendarReport(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    return this.taskboardService.getUserCalendarReport(userId, currentYear, currentMonth);
  }

  @Get('calendar/users/:userId/cleaning-stats')
  async getCleaningStats(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    return this.taskboardService.getCleaningStats(userId, currentYear, currentMonth);
  }

  @Get('calendar/tasks/:taskId/images/:imageId/url')
  async getCalendarImageUrl(
    @Param('taskId') taskId: string,
    @Param('imageId') imageId: string,
  ) {
    console.log(`📥 [Gateway] getCalendarImageUrl - taskId: ${taskId}, imageId: ${imageId}`);
    return this.taskboardService.getCalendarImageUrl(taskId, imageId);
  }

  // ========== GOOGLE CALENDAR - AUTH ==========

  /**
   * Redirige al usuario a Google para autorizar Calendar
   * Ejemplo: GET /taskboard/calendar/auth/google/5feee4d7...
   */
  @Get('calendar/auth/google/:userId')
  @Redirect()
  async googleAuth(@Param('userId') userId: string) {
    console.log(`🔍 [Gateway] googleAuth - userId: ${userId}`);
    
    // ✅ En producción usar el dominio, en desarrollo localhost
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? 'http://ms.teamcellmania.com:3005'  // 👈 Ajusta según tu dominio
      : 'http://localhost:3005';
    
    const url = `${baseUrl}/calendar/auth/google/${userId}`;
    console.log(`📤 [Gateway] Redirigiendo a: ${url}`);
    return { url, statusCode: 302 };
  }

  /**
   * Callback de Google después de la autorización
   * Google redirige aquí con el código de autorización
   */
  @Get('calendar/oauth-callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    console.log(`🔍 [Gateway] oauthCallback - code: ${code?.substring(0, 10)}..., state: ${state}`);
    const callbackUrl = `http://ms-task-board:3001/calendar/oauth-callback?code=${code}&state=${state}`;
    return res.redirect(callbackUrl);
  }

  /**
   * Verificar si el usuario tiene Google Calendar conectado
   * Ejemplo: GET /taskboard/calendar/auth/status/5feee4d7...
   */
  @Get('calendar/auth/status/:userId')
  async getAuthStatus(@Param('userId') userId: string) {
    return this.taskboardService.getAuthStatus(userId);
  }

  /**
   * Desconectar Google Calendar
   * Ejemplo: DELETE /taskboard/calendar/auth/5feee4d7...
   */
  @Delete('calendar/auth/:userId')
  async disconnectGoogle(@Param('userId') userId: string) {
    return this.taskboardService.disconnectGoogle(userId);
  }

  // ========== GOOGLE CALENDAR - SYNC ==========

  /**
   * Sincronizar tareas pendientes a Google Calendar
   * Ejemplo: POST /taskboard/calendar/sync-pending/5feee4d7...
   */
  @Post('calendar/sync-pending/:userId')
  async syncPendingTasks(@Param('userId') userId: string) {
    return this.taskboardService.syncPendingTasks(userId);
  }

  /**
   * Sincronizar tareas de un mes específico a Google Calendar
   * Ejemplo: POST /taskboard/calendar/sync-month/5feee4d7...
   * Body: { "year": 2026, "month": 6 }
   */
  @Post('calendar/sync-month/:userId')
  async syncMonthTasks(
    @Param('userId') userId: string,
    @Body() body: { year: number; month: number }
  ) {
    return this.taskboardService.syncMonthTasks(userId, body.year, body.month);
  }

  /**
   * Obtener eventos de Google Calendar
   * Ejemplo: GET /taskboard/calendar/google-events/5feee4d7?timeMin=2026-06-01T00:00:00Z
   */
  @Get('calendar/google-events/:userId')
  async getGoogleEvents(
    @Param('userId') userId: string,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    return this.taskboardService.getGoogleEvents(userId, timeMin, timeMax);
  }
}