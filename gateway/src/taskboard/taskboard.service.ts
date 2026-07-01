import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class TaskboardService {
  private taskboardHttpUrl = 'http://ms-task-board:3001';

  constructor(
    @Inject('TASKBOARD_CLIENT')
    private readonly taskboardClient: ClientProxy,
    @Inject('USERS_CLIENT')
    private readonly usersClient: ClientProxy,
    private readonly httpService: HttpService,
  ) {}

  // ========== USERS (para buscar miembros) ==========
  
  async getAllUsers() {
    console.log('📤 [Gateway] Enviando a Users: getAllUsers - INICIO');
    try {
      const result = await lastValueFrom(this.usersClient.send({ cmd: 'get_all_users' }, {}));
      console.log('✅ Respuesta recibida:', result?.length || 0, 'usuarios');
      return result;
    } catch (error) {
      console.error('❌ Error en getAllUsers:', error);
      return [];
    }
  }

  async searchUsers(search: string) {
    console.log(`📤 [Gateway] searchUsers - search: ${search}`);
    try {
      const users = await this.getAllUsers();
      if (!search) return users;
      const filtered = users.filter(user => 
        (user.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(search.toLowerCase())
      );
      return filtered;
    } catch (error) {
      console.error('Error en searchUsers:', error);
      return [];
    }
  }

  // ========== ROLES ==========
  
  async getRoles() {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getRoles`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.roles.findAll' }, {}));
  }

  async createRole(data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: createRole - name: ${data.name}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.roles.create' }, data));
  }

  // ========== BOARDS ==========
  
  async createBoard(data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: createBoard - name: ${data.name}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.create' }, data));
  }

  async findAllBoards() {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findAllBoards`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.findAll' }, {}));
  }

  async findBoardsByUser(userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findBoardsByUser - userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.findByUser' }, userId));
  }

  async findOneBoard(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findOneBoard - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.findOne' }, id));
  }

  async updateBoard(id: string, data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: updateBoard - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.update' }, { id, ...data }));
  }

  async removeBoard(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: removeBoard - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.remove' }, id));
  }

  async addMember(boardId: string, userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: addMember - boardId: ${boardId}, userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.addMember' }, { id: boardId, userId }));
  }

  async removeMember(boardId: string, userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: removeMember - boardId: ${boardId}, userId: ${userId}`);
    try {
      const result = await lastValueFrom(
        this.taskboardClient.send({ cmd: 'boards.removeMember' }, { boardId, userId })
      );
      if (!result) {
        return { success: true, message: 'Miembro eliminado correctamente' };
      }
      return result;
    } catch (error) {
      console.error(`❌ [Gateway] Error en removeMember:`, error);
      throw error;
    }
  }

  // ========== MIEMBROS (obtener datos del usuario) ==========
  
  async getUserById(userId: string) {
    if (!userId) {
      return null;
    }
    try {
      const users = await lastValueFrom(this.usersClient.send({ cmd: 'get_all_users' }, {}));
      return users.find(user => user.id === userId) || null;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, (error as any).message);
      return null;
    }
  }

  async getBoardMembersWithDetails(boardId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getBoardMembersWithDetails - boardId: ${boardId}`);
    try {
      const members = await lastValueFrom(this.taskboardClient.send({ cmd: 'boards.getMembersWithDetails' }, boardId));
      return members;
    } catch (error) {
      console.error(`Error en getBoardMembersWithDetails:`, (error as any).message);
      return [];
    }
  }

  async updateMemberRole(boardId: string, userId: string, data: { roleName: string }) {
    console.log(`📤 [Gateway] updateMemberRole - boardId: ${boardId}, userId: ${userId}, roleName: ${data.roleName}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.updateMemberRole' }, { boardId, userId, roleName: data.roleName }));
  }

  // ========== INVITACIONES ==========

  async inviteMember(boardId: string, data: { userId: string; roleName: string; expiresInDays?: number }) {
    console.log(`📤 [Gateway] inviteMember - boardId: ${boardId}, userId: ${data.userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.inviteMember' }, { boardId, ...data }));
  }

  async acceptInvitation(invitationId: string) {
    console.log(`📤 [Gateway] acceptInvitation - invitationId: ${invitationId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.acceptInvitation' }, invitationId));
  }

  async getPendingInvitations(userId: string) {
    console.log(`📤 [Gateway] getPendingInvitations - userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.getPendingInvitations' }, userId));
  }

  // ========== TASKS ==========
  
  async createTask(data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: createTask - title: ${data.title}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.create' }, data));
  }

  async findAllTasks() {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findAllTasks`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.findAll' }, {}));
  }

  async findTasksByBoard(boardId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findTasksByBoard - boardId: ${boardId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.findByBoard' }, boardId));
  }

  async findTasksByUser(userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findTasksByUser - userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.findByUser' }, userId));
  }

  async findOneTask(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findOneTask - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.findOne' }, id));
  }

  async updateTask(id: string, data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: updateTask - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.update' }, { id, updateTaskDto: data }));
  }

  async removeTask(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: removeTask - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.remove' }, id));
  }

  // ========== COMENTARIOS ==========

  async getTaskComments(taskId: string) {
    console.log(`📤 [Gateway] getTaskComments - taskId: ${taskId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.comments.findByTask' }, taskId));
  }

  async createComment(taskId: string, data: { content: string; userId: string; parentCommentId?: string }) {
    console.log(`📤 [Gateway] createComment - taskId: ${taskId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.comments.create' }, { taskId, ...data }));
  }

  async updateComment(commentId: string, data: { content: string }) {
    console.log(`📤 [Gateway] updateComment - commentId: ${commentId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.comments.update' }, { id: commentId, updateCommentDto: data }));
  }

  async deleteComment(commentId: string) {
    console.log(`📤 [Gateway] deleteComment - commentId: ${commentId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.comments.delete' }, commentId));
  }

  // ========== SUBTAREAS ==========

  async getTaskSubtasks(taskId: string) {
    console.log(`📤 [Gateway] getTaskSubtasks - taskId: ${taskId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.subtasks.findByTask' }, taskId));
  }

  async createSubtask(taskId: string, data: { title: string; description?: string; assignedTo?: string; dueDate?: string }) {
    console.log(`📤 [Gateway] createSubtask - taskId: ${taskId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.subtasks.create' }, { parentTaskId: taskId, ...data }));
  }

  async updateSubtask(subtaskId: string, data: any) {
    console.log(`📤 [Gateway] updateSubtask - subtaskId: ${subtaskId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.subtasks.update' }, { id: subtaskId, updateSubTaskDto: data }));
  }

  async updateSubtaskStatus(subtaskId: string, status: string) {
    console.log(`📤 [Gateway] updateSubtaskStatus - subtaskId: ${subtaskId}, status: ${status}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.subtasks.updateStatus' }, { id: subtaskId, status }));
  }

  async deleteSubtask(subtaskId: string) {
    console.log(`📤 [Gateway] deleteSubtask - subtaskId: ${subtaskId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.subtasks.delete' }, subtaskId));
  }

  // ========== COLUMNAS ==========
  
  async getColumns(boardId: string) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.getColumns' }, boardId));
  }

  async createColumn(boardId: string, data: any) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.addColumn' }, { boardId, createColumnDto: data }));
  }

  async updateColumn(columnId: string, data: any) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.updateColumn' }, { columnId, updateColumnDto: data }));
  }

  async deleteColumn(columnId: string) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.removeColumn' }, columnId));
  }

  async setupDefaultColumns(boardId: string) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.setupDefaultColumns' }, boardId));
  }

  async reorderColumns(columnIds: string[]) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.reorderColumns' }, columnIds));
  }

  async moveTask(boardId: string, data: any) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.moveTask' }, { boardId, moveTaskDto: data }));
  }

  async addTaskToColumn(columnId: string, taskId: string) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.addTaskToColumn' }, { columnId, taskId }));
  }

  async removeTaskFromColumn(columnId: string, taskId: string) {
    return lastValueFrom(this.taskboardClient.send({ cmd: 'boards.removeTaskFromColumn' }, { columnId, taskId }));
  }

  // ========== LABELS ==========
  
  async createLabel(data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: createLabel - name: ${data.name}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'labels.create' }, data));
  }

  async findAllLabels() {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findAllLabels`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'labels.findAll' }, {}));
  }

  async findLabelsByBoard(boardId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findLabelsByBoard - boardId: ${boardId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'labels.findByBoard' }, boardId));
  }

  async findOneLabel(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: findOneLabel - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'labels.findOne' }, id));
  }

  async updateLabel(id: string, data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: updateLabel - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'labels.update' }, { id, ...data }));
  }

  async removeLabel(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: removeLabel - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'labels.remove' }, id));
  }

  // ========== COLABORADORES ==========
  
  async addCollaborator(taskId: string, userId: string, addedBy: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: addCollaborator - taskId: ${taskId}, userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.addCollaborator' }, { taskId, userId, addedBy }));
  }

  async getCollaborators(taskId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getCollaborators - taskId: ${taskId}`);
    try {
      const collaborators = await lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.getCollaborators' }, taskId));
      if (!collaborators || collaborators.length === 0) {
        return [];
      }
      const collaboratorsWithDetails = await Promise.all(
        collaborators.map(async (collaborator: any) => {
          if (!collaborator.userId) {
            return {
              ...collaborator,
              user: { id: collaborator.userId, name_user: 'Unknown', email_user: 'unknown' }
            };
          }
          try {
            const user = await this.getUserById(collaborator.userId);
            return {
              ...collaborator,
              user: user || { id: collaborator.userId, name_user: 'Unknown', email_user: 'unknown' }
            };
          } catch (error) {
            return {
              ...collaborator,
              user: { id: collaborator.userId, name_user: 'Unknown', email_user: 'unknown' }
            };
          }
        })
      );
      return collaboratorsWithDetails;
    } catch (error) {
      console.error(`Error en getCollaborators:`, (error as any).message);
      return [];
    }
  }

  async removeCollaborator(taskId: string, userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: removeCollaborator - taskId: ${taskId}, userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'tasks.removeCollaborator' }, { taskId, userId }));
  }

  // ========== IMÁGENES (USANDO HTTP) ==========

  async uploadImage(taskId: string, file: any, taskDetailId?: string) {
    console.log(`📤 [Gateway] uploadImage - INICIO`);
    console.log(`  - taskId: ${taskId}`);
    console.log(`  - file existe: ${!!file}`);
    
    if (!file) {
      console.error('❌ No se recibió ningún archivo');
      throw new Error('No file uploaded');
    }
    
    console.log(`  - fileName: ${file.originalname}`);
    console.log(`  - fileSize: ${file.size}`);
    console.log(`  - mimeType: ${file.mimetype}`);
    
    // Por ahora, devolver un mock para probar
    return {
      success: true,
      data: {
        id: 'mock-id',
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      }
    };
  }

  async uploadImageBase64(taskId: string, data: { file: string; originalName: string; mimeType: string; taskDetailId?: string }) {
    console.log(`📤 [Gateway] uploadImageBase64 - taskId: ${taskId}`);
    
    try {
      const response = await axios.post(
        `${this.taskboardHttpUrl}/tasks/${taskId}/images/base64`,
        {
          file: data.file,
          originalName: data.originalName,
          mimeType: data.mimeType,
          taskDetailId: data.taskDetailId
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en uploadImageBase64:', error.message);
      throw error;
    }
  }

  async getTaskImages(taskId: string) {
    console.log(`📤 [Gateway] getTaskImages via HTTP - taskId: ${taskId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.get(`${this.taskboardHttpUrl}/tasks/${taskId}/images`)
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en getTaskImages:', error.message);
      throw error;
    }
  }

  async getTaskDetailImages(taskId: string, taskDetailId: string) {
    console.log(`📤 [Gateway] getTaskDetailImages via HTTP - taskId: ${taskId}, taskDetailId: ${taskDetailId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.get(`${this.taskboardHttpUrl}/tasks/${taskId}/images/detail/${taskDetailId}`)
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en getTaskDetailImages:', error.message);
      throw error;
    }
  }

  async getImageUrl(taskId: string, imageId: string) {
    console.log(`📤 [Gateway] getImageUrl via HTTP - taskId: ${taskId}, imageId: ${imageId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.get(`${this.taskboardHttpUrl}/tasks/${taskId}/images/${imageId}/url`)
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en getImageUrl:', error.message);
      throw error;
    }
  }

  async deleteImage(taskId: string, imageId: string) {
    console.log(`📤 [Gateway] deleteImage via HTTP - taskId: ${taskId}, imageId: ${imageId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.delete(`${this.taskboardHttpUrl}/tasks/${taskId}/images/${imageId}`)
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en deleteImage:', error.message);
      throw error;
    }
  }

  // ========== PUSH NOTIFICATIONS ==========

  async getVapidPublicKey() {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getVapidPublicKey`);
    return lastValueFrom(
      this.taskboardClient.send({ cmd: 'push-notifications.vapid-public-key' }, {})
    );
  }

  async subscribeToPush(userId: string, subscription: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: subscribeToPush - userId: ${userId}`);
    return lastValueFrom(
      this.taskboardClient.send({ cmd: 'push-notifications.subscribe' }, { userId, subscription })
    );
  }

  async unsubscribeFromPush(userId: string, endpoint: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: unsubscribeFromPush - userId: ${userId}`);
    return lastValueFrom(
      this.taskboardClient.send({ cmd: 'push-notifications.unsubscribe' }, { userId, endpoint })
    );
  }

  async getUserPushSubscriptions(userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getUserPushSubscriptions - userId: ${userId}`);
    return lastValueFrom(
      this.taskboardClient.send({ cmd: 'push-notifications.user-subscriptions' }, { userId })
    );
  }

  // ========== CALENDAR / TAREAS DE LIMPIEZA ==========

  async createCalendarTask(data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard (HTTP): createCalendarTask - title: ${data.title}`);
    try {
      const response = await lastValueFrom(
        this.httpService.post(`${this.taskboardHttpUrl}/calendar/tasks`, data)
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en createCalendarTask:', error.message);
      throw error;
    }
  }

  async getUserCalendarTasks(userId: string, year: number, month: number) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getUserCalendarTasks - userId: ${userId}, year: ${year}, month: ${month}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.findByUser' }, { userId, year, month }));
  }

  async getAllCalendarTasksForMonth(year: number, month: number, userId?: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getAllCalendarTasksForMonth - year: ${year}, month: ${month}, userId: ${userId || 'todos'}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.findAllForMonth' }, { year, month, userId }));
  }

  async updateCalendarTask(id: string, data: any) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: updateCalendarTask - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.update' }, { id, ...data }));
  }

  async deleteCalendarTask(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: deleteCalendarTask - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.delete' }, id));
  }

  async toggleCalendarTaskComplete(id: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: toggleCalendarTaskComplete - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.toggleComplete' }, id));
  }

  async completeCalendarTaskWithPhoto(id: string, data: { completionPhotoUrl: string; completionNotes?: string }) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: completeCalendarTaskWithPhoto - id: ${id}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.completeWithPhoto' }, { id, ...data }));
  }

  async getTodayCalendarTasks(userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getTodayCalendarTasks - userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.today' }, userId));
  }

  async getPendingCalendarTasks(userId: string) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getPendingCalendarTasks - userId: ${userId}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.tasks.pending' }, userId));
  }

  async getUserCalendarReport(userId: string, year: number, month: number) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getUserCalendarReport - userId: ${userId}, year: ${year}, month: ${month}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.report.user' }, { userId, year, month }));
  }

  async getCleaningStats(userId: string, year: number, month: number) {
    console.log(`📤 [Gateway] Enviando a TaskBoard: getCleaningStats - userId: ${userId}, year: ${year}, month: ${month}`);
    return lastValueFrom(this.taskboardClient.send({ cmd: 'calendar.stats.cleaning' }, { userId, year, month }));
  }

  async getCalendarImageUrl(taskId: string, imageId: string) {
    console.log(`📤 [Gateway] getCalendarImageUrl - taskId: ${taskId}, imageId: ${imageId}`);
    try {
      // 🔥 Usar HTTP directo al microservicio (puerto 3001)
      const response = await lastValueFrom(
        this.httpService.get(`${this.taskboardHttpUrl}/tasks/${taskId}/images/${imageId}/url`)
      );
      console.log('📥 Respuesta del microservicio:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en getCalendarImageUrl:', error.message);
      throw error;
    }
  }

  // ========== GOOGLE CALENDAR - AUTENTICACIÓN ==========

  /**
   * Obtener URL de autorización de Google Calendar
   */
  async getAuthUrl(userId: string) {
    console.log(`📤 [Gateway] getAuthUrl - userId: ${userId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.get(`${this.taskboardHttpUrl}/calendar/auth/google/${userId}`)
      );
      
      // Si la respuesta es un string (redirección), devolverla
      if (typeof response.data === 'string') {
        return response.data;
      }
      
      // Si es un objeto con authUrl
      if (response.data && response.data.authUrl) {
        return response.data.authUrl;
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en getAuthUrl:', error.message);
      throw error;
    }
  }

  /**
   * Verificar si el usuario tiene Google Calendar conectado
   */
  async getAuthStatus(userId: string) {
    console.log(`📤 [Gateway] getAuthStatus - userId: ${userId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.get(`${this.taskboardHttpUrl}/calendar/auth/status/${userId}`)
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en getAuthStatus:', error.message);
      throw error;
    }
  }

  /**
   * Desconectar Google Calendar
   */
  async disconnectGoogle(userId: string) {
    console.log(`📤 [Gateway] disconnectGoogle - userId: ${userId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.delete(`${this.taskboardHttpUrl}/calendar/auth/${userId}`)
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en disconnectGoogle:', error.message);
      throw error;
    }
  }

  /**
   * Sincronizar tareas pendientes a Google Calendar
   */
  async syncPendingTasks(userId: string) {
    console.log(`📤 [Gateway] syncPendingTasks - userId: ${userId}`);
    try {
      const response = await lastValueFrom(
        this.httpService.post(`${this.taskboardHttpUrl}/calendar/sync-pending/${userId}`, {})
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en syncPendingTasks:', error.message);
      throw error;
    }
  }

  /**
   * Sincronizar tareas de un mes específico a Google Calendar
   */
  async syncMonthTasks(userId: string, year: number, month: number) {
    console.log(`📤 [Gateway] syncMonthTasks - userId: ${userId}, year: ${year}, month: ${month}`);
    try {
      const response = await lastValueFrom(
        this.httpService.post(`${this.taskboardHttpUrl}/calendar/sync-month/${userId}`, { year, month })
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en syncMonthTasks:', error.message);
      throw error;
    }
  }

  /**
   * Obtener eventos de Google Calendar
   */
  async getGoogleEvents(userId: string, timeMin?: string, timeMax?: string) {
    console.log(`📤 [Gateway] getGoogleEvents - userId: ${userId}`);
    try {
      let url = `${this.taskboardHttpUrl}/calendar/google-events/${userId}`;
      if (timeMin) url += `?timeMin=${encodeURIComponent(timeMin)}`;
      if (timeMax) url += `${timeMin ? '&' : '?'}timeMax=${encodeURIComponent(timeMax)}`;
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en getGoogleEvents:', error.message);
      throw error;
    }
  }
}