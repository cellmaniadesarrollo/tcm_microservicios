// gateway/src/taskboard/taskboard.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Param,
  Res,
  Patch,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
  Redirect,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { TaskboardService } from './taskboard.service';

import { Auth } from '../common/auth/decorators/auth.decorator';
import { Public } from '../common/auth/decorators/public.decorator';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { Features } from '../common/auth/decorators/features.decorator';
import { User } from '../common/auth/decorators/user.decorator';

@Controller('taskboard')
@Auth()
@Features('taskboard')
export class TaskboardController {
  constructor(private readonly taskboardService: TaskboardService) {}

  // ============================================================
  // RUTAS PÚBLICAS
  // ============================================================

  @Get('ping')
  @Public()
  async ping() {
    return { pong: true, timestamp: new Date().toISOString() };
  }

  @Get('health')
  @Public()
  async health() {
    return { status: 'ok', service: 'taskboard' };
  }

  // ============================================================
  // USERS
  // ============================================================

  @Get('users')
  @Groups('ADMIN', 'MANAGER')
  async getAllUsers(@User() user: any) {
    // 🔥 PASAR EL USUARIO AL SERVICIO PARA FILTRAR POR COMPANYID
    return this.taskboardService.getAllUsers(user);
  }

  @Get('users/search')
  @Groups('ADMIN', 'MANAGER')
  async searchUsers(@Query('q') search: string, @User() user: any) {
    return this.taskboardService.searchUsers(search);
  }

  @Get('users/:id')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getUserById(@Param('id') id: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== id) {
      throw new BadRequestException('No puedes ver el perfil de otro usuario');
    }
    return this.taskboardService.getUserById(id);
  }

  // ============================================================
  // BOARDS
  // ============================================================

  @Get('boards/roles')
  @Groups('ADMIN', 'MANAGER')
  getRoles(@User() user: any) {
    return this.taskboardService.getRoles();
  }

  @Post('boards/roles')
  @Groups('ADMIN')
  createRole(@Body() data: any, @User() user: any) {
    return this.taskboardService.createRole(data);
  }

  @Get('boards/user/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findBoardsByUser(@Param('userId') userId: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (isAdmin) {
      return this.taskboardService.findBoardsByUser(userId);
    }
    if (user?.sub !== userId) {
      throw new BadRequestException('No puedes ver los boards de otro usuario');
    }
    return this.taskboardService.findBoardsByUser(user.sub);
  }

  @Post('boards')
  @Groups('ADMIN', 'MANAGER')
  createBoard(@Body() data: any, @User() user: any) {
    return this.taskboardService.createBoard({ ...data, createdBy: user.sub });
  }

  @Get('boards')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findAllBoards(@User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (isAdmin) {
      return this.taskboardService.findAllBoards();
    }
    return this.taskboardService.findBoardsByUser(user.sub);
  }

  @Get('boards/:id')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findOneBoard(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.findOneBoard(id);
  }

  @Patch('boards/:id')
  @Groups('ADMIN', 'MANAGER')
  updateBoard(@Param('id') id: string, @Body() data: any, @User() user: any) {
    return this.taskboardService.updateBoard(id, data);
  }

  @Delete('boards/:id')
  @Groups('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBoard(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.removeBoard(id);
  }

  @Get('boards/:id/members')
  @Groups('ADMIN', 'MANAGER')
  async getBoardMembers(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.getBoardMembersWithDetails(id);
  }

  @Post('boards/:id/members/:userId')
  @Groups('ADMIN', 'MANAGER')
  addMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @User() user: any
  ) {
    return this.taskboardService.addMember(id, userId);
  }

  @Delete('boards/:id/members/:userId')
  @Groups('ADMIN', 'MANAGER')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @User() user: any
  ) {
    return this.taskboardService.removeMember(id, userId);
  }

  @Patch('boards/:id/members/:userId/role')
  @Groups('ADMIN', 'MANAGER')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() data: { roleName: string },
    @User() user: any
  ) {
    return this.taskboardService.updateMemberRole(id, userId, data);
  }

  // ============================================================
  // INVITACIONES
  // ============================================================

  @Post('boards/:id/invitations')
  @Groups('ADMIN', 'MANAGER')
  async inviteMember(
    @Param('id') id: string,
    @Body() data: { userId: string; roleName: string; expiresInDays?: number },
    @User() user: any
  ) {
    return this.taskboardService.inviteMember(id, data);
  }

  @Post('invitations/:invitationId/accept')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async acceptInvitation(
    @Param('invitationId') invitationId: string,
    @User() user: any
  ) {
    return this.taskboardService.acceptInvitation(invitationId);
  }

  @Get('invitations/pending')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getPendingInvitations(
    @Query('userId') userId: string,
    @User() user: any
  ) {
    if (user?.sub !== userId && !user?.groups?.includes('ADMIN')) {
      throw new BadRequestException('No puedes ver las invitaciones de otro usuario');
    }
    return this.taskboardService.getPendingInvitations(userId);
  }

  // ============================================================
  // TASKS
  // ============================================================

  @Post('tasks')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  createTask(@Body() data: any, @User() user: any) {
    return this.taskboardService.createTask({ ...data, createdBy: user.sub });
  }

  @Get('tasks')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findAllTasks(@User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (isAdmin) {
      return this.taskboardService.findAllTasks();
    }
    return this.taskboardService.findTasksByUser(user.sub);
  }

  @Get('tasks/board/:boardId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findTasksByBoard(@Param('boardId') boardId: string, @User() user: any) {
    return this.taskboardService.findTasksByBoard(boardId);
  }

  @Get('tasks/user/:userId')
  @Groups('ADMIN', 'MANAGER')
  findTasksByUser(@Param('userId') userId: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin) {
      throw new BadRequestException('No tienes permisos para ver tareas de otros usuarios');
    }
    return this.taskboardService.findTasksByUser(userId);
  }

  @Get('tasks/:id')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findOneTask(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.findOneTask(id);
  }

  @Patch('tasks/:id')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  updateTask(@Param('id') id: string, @Body() data: any, @User() user: any) {
    return this.taskboardService.updateTask(id, data);
  }

  @Delete('tasks/:id')
  @Groups('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTask(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.removeTask(id);
  }

  // ============================================================
  // IMÁGENES
  // ============================================================

  @Post('tasks/:taskId/images')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('taskId') taskId: string,          // ✅ Requerido
    @UploadedFile() file: any,                // ✅ Requerido
    @User() user: any,                        // ✅ Requerido (ANTES del opcional)
    @Body('taskDetailId') taskDetailId?: string // ✅ Opcional (ÚLTIMO)
  ) {
    return {
      success: true,
      message: 'Prueba - imagen recibida',
      data: { taskId, fileName: file?.originalname }
    };
  }

  @Post('tasks/:taskId/images/base64')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async uploadImageBase64(
    @Param('taskId') taskId: string,
    @Body() body: { file: string; originalName: string; mimeType: string; taskDetailId?: string },
    @User() user: any
  ) {
    return this.taskboardService.uploadImageBase64(taskId, body);
  }

  @Get('tasks/:taskId/images')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getTaskImages(@Param('taskId') taskId: string, @User() user: any) {
    return this.taskboardService.getTaskImages(taskId);
  }

  @Get('tasks/:taskId/images/detail/:taskDetailId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getTaskDetailImages(
    @Param('taskId') taskId: string,
    @Param('taskDetailId') taskDetailId: string,
    @User() user: any
  ) {
    return this.taskboardService.getTaskDetailImages(taskId, taskDetailId);
  }

  @Get('tasks/:taskId/images/:imageId/url')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getImageUrl(
    @Param('taskId') taskId: string,
    @Param('imageId') imageId: string,
    @User() user: any
  ) {
    return this.taskboardService.getImageUrl(taskId, imageId);
  }

  @Delete('tasks/:taskId/images/:imageId')
  @Groups('ADMIN', 'MANAGER')
  async deleteImage(
    @Param('taskId') taskId: string,
    @Param('imageId') imageId: string,
    @User() user: any
  ) {
    return this.taskboardService.deleteImage(taskId, imageId);
  }

  // ============================================================
  // COMENTARIOS
  // ============================================================

  @Get('tasks/:id/comments')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getTaskComments(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.getTaskComments(id);
  }

  @Post('tasks/:id/comments')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async createComment(
    @Param('id') id: string,
    @Body() data: { content: string; userId: string; parentCommentId?: string },
    @User() user: any
  ) {
    return this.taskboardService.createComment(id, data);
  }

  @Patch('tasks/comments/:commentId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() data: { content: string },
    @User() user: any
  ) {
    return this.taskboardService.updateComment(commentId, data);
  }

  @Delete('tasks/comments/:commentId')
  @Groups('ADMIN', 'MANAGER')
  async deleteComment(@Param('commentId') commentId: string, @User() user: any) {
    return this.taskboardService.deleteComment(commentId);
  }

  // ============================================================
  // SUBTAREAS
  // ============================================================

  @Get('tasks/:id/subtasks')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getTaskSubtasks(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.getTaskSubtasks(id);
  }

  @Post('tasks/:id/subtasks')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async createSubtask(
    @Param('id') id: string,
    @Body() data: { title: string; description?: string; assignedTo?: string; dueDate?: string },
    @User() user: any
  ) {
    return this.taskboardService.createSubtask(id, data);
  }

  @Patch('tasks/subtasks/:subtaskId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async updateSubtask(
    @Param('subtaskId') subtaskId: string,
    @Body() data: any,
    @User() user: any
  ) {
    return this.taskboardService.updateSubtask(subtaskId, data);
  }

  @Patch('tasks/subtasks/:subtaskId/status')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async updateSubtaskStatus(
    @Param('subtaskId') subtaskId: string,
    @Body() data: { status: string },
    @User() user: any
  ) {
    return this.taskboardService.updateSubtaskStatus(subtaskId, data.status);
  }

  @Delete('tasks/subtasks/:subtaskId')
  @Groups('ADMIN', 'MANAGER')
  async deleteSubtask(@Param('subtaskId') subtaskId: string, @User() user: any) {
    return this.taskboardService.deleteSubtask(subtaskId);
  }

  // ============================================================
  // COLUMNAS
  // ============================================================

  @Get('boards/:id/columns')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getColumns(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.getColumns(id);
  }

  @Post('boards/:id/columns')
  @Groups('ADMIN', 'MANAGER')
  async createColumn(
    @Param('id') id: string,
    @Body() data: any,
    @User() user: any
  ) {
    return this.taskboardService.createColumn(id, data);
  }

  @Patch('boards/columns/:columnId')
  @Groups('ADMIN', 'MANAGER')
  async updateColumn(
    @Param('columnId') columnId: string,
    @Body() data: any,
    @User() user: any
  ) {
    return this.taskboardService.updateColumn(columnId, data);
  }

  @Delete('boards/columns/:columnId')
  @Groups('ADMIN')
  async deleteColumn(@Param('columnId') columnId: string, @User() user: any) {
    return this.taskboardService.deleteColumn(columnId);
  }

  @Post('boards/:id/setup-default-columns')
  @Groups('ADMIN', 'MANAGER')
  async setupDefaultColumns(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.setupDefaultColumns(id);
  }

  @Post('boards/:id/reorder-columns')
  @Groups('ADMIN', 'MANAGER')
  async reorderColumns(
    @Param('id') id: string,
    @Body('columnIds') columnIds: string[],
    @User() user: any
  ) {
    return this.taskboardService.reorderColumns(columnIds);
  }

  @Post('boards/:id/move-task')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async moveTask(
    @Param('id') id: string,
    @Body() data: any,
    @User() user: any
  ) {
    return this.taskboardService.moveTask(id, data);
  }

  @Post('boards/columns/:columnId/tasks/:taskId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async addTaskToColumn(
    @Param('columnId') columnId: string,
    @Param('taskId') taskId: string,
    @User() user: any
  ) {
    return this.taskboardService.addTaskToColumn(columnId, taskId);
  }

  @Delete('boards/columns/:columnId/tasks/:taskId')
  @Groups('ADMIN', 'MANAGER')
  async removeTaskFromColumn(
    @Param('columnId') columnId: string,
    @Param('taskId') taskId: string,
    @User() user: any
  ) {
    return this.taskboardService.removeTaskFromColumn(columnId, taskId);
  }

  // ============================================================
  // COLABORADORES
  // ============================================================

  @Post('tasks/:id/collaborators/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  addCollaborator(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('addedBy') addedBy: string,
    @User() user: any
  ) {
    return this.taskboardService.addCollaborator(id, userId, addedBy || userId);
  }

  @Get('tasks/:id/collaborators')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  getCollaborators(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.getCollaborators(id);
  }

  @Delete('tasks/:id/collaborators/:userId')
  @Groups('ADMIN', 'MANAGER')
  removeCollaborator(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @User() user: any
  ) {
    return this.taskboardService.removeCollaborator(id, userId);
  }

  // ============================================================
  // LABELS
  // ============================================================

  @Post('labels')
  @Groups('ADMIN', 'MANAGER')
  createLabel(@Body() data: any, @User() user: any) {
    return this.taskboardService.createLabel(data);
  }

  @Get('labels')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findAllLabels(@User() user: any) {
    return this.taskboardService.findAllLabels();
  }

  @Get('labels/board/:boardId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findLabelsByBoard(@Param('boardId') boardId: string, @User() user: any) {
    return this.taskboardService.findLabelsByBoard(boardId);
  }

  @Get('labels/:id')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  findOneLabel(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.findOneLabel(id);
  }

  @Patch('labels/:id')
  @Groups('ADMIN', 'MANAGER')
  updateLabel(@Param('id') id: string, @Body() data: any, @User() user: any) {
    return this.taskboardService.updateLabel(id, data);
  }

  @Delete('labels/:id')
  @Groups('ADMIN', 'MANAGER')
  removeLabel(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.removeLabel(id);
  }

  // ============================================================
  // PUSH NOTIFICATIONS
  // ============================================================

  @Get('push-notifications/vapid-public-key')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getVapidPublicKey(@User() user: any) {
    return this.taskboardService.getVapidPublicKey();
  }

  @Post('push-notifications/subscribe')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async subscribeToPush(
    @Body('userId') userId: string,
    @Body('subscription') subscription: any,
    @User() user: any
  ) {
    if (!userId) {
      throw new BadRequestException('userId es requerido');
    }
    if (!subscription || !subscription.endpoint) {
      throw new BadRequestException('Suscripción inválida');
    }
    return this.taskboardService.subscribeToPush(userId, subscription);
  }

  @Delete('push-notifications/unsubscribe')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async unsubscribeFromPush(
    @Body('userId') userId: string,
    @Body('endpoint') endpoint: string,
    @User() user: any
  ) {
    if (!userId || !endpoint) {
      throw new BadRequestException('userId y endpoint son requeridos');
    }
    return this.taskboardService.unsubscribeFromPush(userId, endpoint);
  }

  @Get('push-notifications/subscriptions/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getUserPushSubscriptions(@Param('userId') userId: string, @User() user: any) {
    if (user?.sub !== userId && !user?.groups?.includes('ADMIN')) {
      throw new BadRequestException('No puedes ver las suscripciones de otro usuario');
    }
    return this.taskboardService.getUserPushSubscriptions(userId);
  }

  @Post('push-notifications/send')
  @Groups('ADMIN', 'MANAGER')
  async sendNotification(@Body() dto: any, @User() user: any) {
    return this.taskboardService.sendNotification(dto);
  }

  // ============================================================
  // CALENDAR / TAREAS DE LIMPIEZA
  // ============================================================

  @Post('calendar/tasks')
  @Groups('ADMIN', 'MANAGER')
  async createCalendarTask(@Body() data: any, @User() user: any) {
    return this.taskboardService.createCalendarTask(data);
  }

  @Get('calendar/users/:userId/tasks')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getUserCalendarTasks(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @User() user: any
  ) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes ver las tareas de otro usuario');
    }
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    return this.taskboardService.getUserCalendarTasks(userId, currentYear, currentMonth);
  }

  @Get('calendar/monthly-tasks')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getAllCalendarTasksForMonth(
    @User() user: any,
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('userId') userId?: string
  ) {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    
    // 🔥 Pasar companyId del usuario autenticado
    const companyId = user?.companyId;
    
    return this.taskboardService.getAllCalendarTasksForMonth(
      currentYear, 
      currentMonth, 
      userId,
      companyId
    );
  }

  @Put('calendar/tasks/:id')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async updateCalendarTask(
    @Param('id') id: string,
    @Body() data: any,
    @User() user: any
  ) {
    const userId = req.user?.['sub'] || req.user?.['id'] || req.user?.['userId'];
    if (userId) {
      data.userId = userId;
    }
    return this.taskboardService.updateCalendarTask(id, data);
  }

  @Delete('calendar/tasks/:id')
  @Groups('ADMIN', 'MANAGER')
  async deleteCalendarTask(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.deleteCalendarTask(id);
  }

  @Put('calendar/tasks/:id/toggle')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async toggleCalendarTaskComplete(@Param('id') id: string, @User() user: any) {
    return this.taskboardService.toggleCalendarTaskComplete(id);
  }

  @Put('calendar/tasks/:id/complete')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async completeCalendarTaskWithPhoto(
    @Param('id') id: string,
    @Body() data: { completionPhotoUrl: string; completionNotes?: string },
    @User() user: any
  ) {
    const userId = req.user?.['sub'] || req.user?.['id'] || req.user?.['userId'];
    if (!userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.taskboardService.completeCalendarTaskWithPhoto(id, userId, data);
  }

  @Get('calendar/users/:userId/tasks/today')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getTodayCalendarTasks(@Param('userId') userId: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes ver las tareas de otro usuario');
    }
    return this.taskboardService.getTodayCalendarTasks(userId);
  }

  @Get('calendar/users/:userId/tasks/pending')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getPendingCalendarTasks(@Param('userId') userId: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes ver las tareas de otro usuario');
    }
    return this.taskboardService.getPendingCalendarTasks(userId);
  }

  @Get('calendar/users/:userId/report')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getUserCalendarReport(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @User() user: any
  ) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes ver el reporte de otro usuario');
    }
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    return this.taskboardService.getUserCalendarReport(userId, currentYear, currentMonth);
  }

  @Get('calendar/users/:userId/cleaning-stats')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getCleaningStats(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @User() user: any
  ) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes ver las estadísticas de otro usuario');
    }
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    return this.taskboardService.getCleaningStats(userId, currentYear, currentMonth);
  }

  @Get('calendar/tasks/:taskId/images/:imageId/url')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getCalendarImageUrl(
    @Param('taskId') taskId: string,
    @Param('imageId') imageId: string,
    @User() user: any
  ) {
    return this.taskboardService.getCalendarImageUrl(taskId, imageId);
  }

  // ============================================================
  // GOOGLE CALENDAR - AUTH (PÚBLICAS)
  // ============================================================

  @Get('calendar/auth/google/:userId')
  @Public()
  @Redirect()
  async googleAuth(@Param('userId') userId: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction
      ? 'http://ms.teamcellmania.com:3005'
      : 'http://localhost:3005';
    const url = `${baseUrl}/calendar/auth/google/${userId}`;
    return { url, statusCode: 302 };
  }

  @Get('calendar/oauth-callback')
  @Public()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    if (!code || !state) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      return res.redirect(`${frontendUrl}/taskboard/employee-calendar?error=missing_params`);
    }
    const callbackUrl = `http://ms-task-board:3001/calendar/oauth-callback?code=${code}&state=${state}`;
    return res.redirect(callbackUrl);
  }

  // ============================================================
  // GOOGLE CALENDAR - STATUS & SYNC
  // ============================================================

  @Get('calendar/auth/status/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getAuthStatus(@Param('userId') userId: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes ver el estado de otro usuario');
    }
    return this.taskboardService.getAuthStatus(userId);
  }

  @Delete('calendar/auth/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async disconnectGoogle(@Param('userId') userId: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes desconectar la cuenta de otro usuario');
    }
    return this.taskboardService.disconnectGoogle(userId);
  }

  @Post('calendar/sync-pending/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async syncPendingTasks(@Param('userId') userId: string, @User() user: any) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes sincronizar tareas de otro usuario');
    }
    return this.taskboardService.syncPendingTasks(userId);
  }

  @Post('calendar/sync-month/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async syncMonthTasks(
    @Param('userId') userId: string,
    @Body() body: { year: number; month: number },
    @User() user: any
  ) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes sincronizar tareas de otro usuario');
    }
    return this.taskboardService.syncMonthTasks(userId, body.year, body.month);
  }

  @Get('calendar/google-events/:userId')
  @Groups('ADMIN', 'MANAGER', 'EMPLOYEE')
  async getGoogleEvents(
    @User() user: any,
    @Param('userId') userId: string,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string
  ) {
    const isAdmin = user?.groups?.includes('ADMIN') || user?.groups?.includes('MANAGER');
    if (!isAdmin && user?.sub !== userId) {
      throw new BadRequestException('No puedes ver eventos de otro usuario');
    }
    return this.taskboardService.getGoogleEvents(userId, timeMin, timeMax);
  }
}