// gateway/src/taskboard/taskboard.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Delete, Query } from '@nestjs/common';
import { TaskboardService } from './taskboard.service';

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
}