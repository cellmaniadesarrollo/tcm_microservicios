// tasks/tasks.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TasksService } from './tasks.service';
import { TaskCommentsService } from './task-comments.service';
import { SubTasksService } from './subtasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateSubTaskDto } from './dto/create-subtask.dto';
import { UpdateSubTaskDto } from './dto/update-subtask.dto';

@Controller()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly commentsService: TaskCommentsService,
    private readonly subtasksService: SubTasksService,
  ) {}

  // ==================== ENDPOINTS BÁSICOS DE TAREAS ====================

  @MessagePattern({ cmd: 'tasks.create' })
  create(@Payload() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @MessagePattern({ cmd: 'tasks.findAll' })
  findAll() {
    return this.tasksService.findAll();
  }

  @MessagePattern({ cmd: 'tasks.findByBoard' })
  findByBoard(@Payload() boardId: string) {
    return this.tasksService.findByBoard(boardId);
  }

  @MessagePattern({ cmd: 'tasks.findByUser' })
  findByUser(@Payload() userId: string) {
    return this.tasksService.findByUser(userId);
  }

  @MessagePattern({ cmd: 'tasks.findOne' })
  findOne(@Payload() id: string) {
    return this.tasksService.findOne(id);
  }

  @MessagePattern({ cmd: 'tasks.update' })
  update(@Payload() data: { id: string; updateTaskDto: UpdateTaskDto }) {
    return this.tasksService.update(data.id, data.updateTaskDto);
  }

  @MessagePattern({ cmd: 'tasks.remove' })
  remove(@Payload() id: string) {
    return this.tasksService.remove(id);
  }

  // ==================== ENDPOINTS DE COLABORADORES ====================

  @MessagePattern({ cmd: 'tasks.addCollaborator' })
  addCollaborator(@Payload() data: { taskId: string; userId: string; addedBy: string }) {
    return this.tasksService.addCollaborator(data.taskId, data.userId, data.addedBy || data.userId);
  }

  @MessagePattern({ cmd: 'tasks.addMultipleCollaborators' })
  addMultipleCollaborators(@Payload() data: { taskId: string; userIds: string[]; addedBy: string }) {
    return this.tasksService.addMultipleCollaborators(data.taskId, data.userIds, data.addedBy);
  }

  @MessagePattern({ cmd: 'tasks.getCollaborators' })
  getCollaborators(@Payload() taskId: string) {
    return this.tasksService.getCollaborators(taskId);
  }

  @MessagePattern({ cmd: 'tasks.removeCollaborator' })
  removeCollaborator(@Payload() data: { taskId: string; userId: string }) {
    return this.tasksService.removeCollaborator(data.taskId, data.userId);
  }

  // ==================== ENDPOINTS DE COMENTARIOS ====================

  @MessagePattern({ cmd: 'tasks.comments.findByTask' })
  async getTaskComments(@Payload() taskId: string) {
    return this.commentsService.findByTask(taskId);
  }

  @MessagePattern({ cmd: 'tasks.comments.create' })
  async createComment(@Payload() createCommentDto: CreateCommentDto) {
    return this.commentsService.create(createCommentDto);
  }

  @MessagePattern({ cmd: 'tasks.comments.update' })
  async updateComment(@Payload() data: { id: string; updateCommentDto: UpdateCommentDto }) {
    return this.commentsService.update(data.id, data.updateCommentDto);
  }

  @MessagePattern({ cmd: 'tasks.comments.delete' })
  async deleteComment(@Payload() id: string) {
    return this.commentsService.delete(id);
  }

  @MessagePattern({ cmd: 'tasks.comments.findByUser' })
  async getCommentsByUser(@Payload() userId: string) {
    return this.commentsService.findByUser(userId);
  }

  @MessagePattern({ cmd: 'tasks.comments.getReplies' })
  async getCommentReplies(@Payload() commentId: string) {
    return this.commentsService.getReplies(commentId);
  }

  // ==================== ENDPOINTS DE SUBTAREAS ====================

  @MessagePattern({ cmd: 'tasks.subtasks.findByTask' })
  async getTaskSubtasks(@Payload() taskId: string) {
    return this.subtasksService.findByTask(taskId);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.create' })
  async createSubtask(@Payload() createSubTaskDto: CreateSubTaskDto) {
    return this.subtasksService.create(createSubTaskDto);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.update' })
  async updateSubtask(@Payload() data: { id: string; updateSubTaskDto: UpdateSubTaskDto }) {
    return this.subtasksService.update(data.id, data.updateSubTaskDto);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.delete' })
  async deleteSubtask(@Payload() id: string) {
    return this.subtasksService.delete(id);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.updateStatus' })
  async updateSubtaskStatus(@Payload() data: { id: string; status: string }) {
    return this.subtasksService.updateStatus(data.id, data.status as any);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.reorder' })
  async reorderSubtasks(@Payload() data: { taskId: string; subtaskIds: string[] }) {
    return this.subtasksService.reorder(data.taskId, data.subtaskIds);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.moveToTask' })
  async moveSubtaskToTask(@Payload() data: { subtaskId: string; newParentTaskId: string }) {
    return this.subtasksService.moveToTask(data.subtaskId, data.newParentTaskId);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.findByUser' })
  async getSubtasksByUser(@Payload() userId: string) {
    return this.subtasksService.findByUser(userId);
  }

  @MessagePattern({ cmd: 'tasks.subtasks.findOverdue' })
  async getOverdueSubtasks() {
    return this.subtasksService.findOverdue();
  }

  @MessagePattern({ cmd: 'tasks.subtasks.getStats' })
  async getSubtaskStats(@Payload() taskId: string) {
    return this.subtasksService.getTaskSubtaskStats(taskId);
  }
}