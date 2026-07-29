// task-board/src/calendar/calendar-tcp.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CalendarService } from './calendar.service';
import { CreateEmployeeTaskDto } from './dto/create-employee-task.dto';
import { UpdateEmployeeTaskDto } from './dto/update-employee-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';

@Controller()
export class CalendarTcpController {
  constructor(private readonly calendarService: CalendarService) {}

  // ==================== CRUD BÁSICO ====================

  @MessagePattern({ cmd: 'calendar.tasks.create' })
  async createTask(@Payload() createDto: CreateEmployeeTaskDto) {
    console.log(`📥 [TCP] calendar.tasks.create - title: ${createDto.title}`);
    return await this.calendarService.createTask(createDto);
  }

  @MessagePattern({ cmd: 'calendar.tasks.findByUser' })
  async getTasksByUser(@Payload() data: { userId: string; year: number; month: number }) {
    console.log(`📥 [TCP] calendar.tasks.findByUser - userId: ${data.userId}, year: ${data.year}, month: ${data.month}`);
    return await this.calendarService.getTasksByUser(data.userId, { 
      year: data.year, 
      month: data.month 
    });
  }

  @MessagePattern({ cmd: 'calendar.tasks.findAllForMonth' })
  async getAllTasksForMonth(@Payload() data: { year: number; month: number; userId?: string }) {
    console.log(`📥 [TCP] calendar.tasks.findAllForMonth - year: ${data.year}, month: ${data.month}`);
    return await this.calendarService.getAllTasksForMonth({ 
      year: data.year, 
      month: data.month, 
      userId: data.userId 
    });
  }

  @MessagePattern({ cmd: 'calendar.tasks.update' })
  async updateTask(@Payload() data: { id: string } & UpdateEmployeeTaskDto) {
    console.log(`📥 [TCP] calendar.tasks.update - id: ${data.id}`);
    const { id, ...updateData } = data;
    return await this.calendarService.updateTask(id, updateData);
  }

  @MessagePattern({ cmd: 'calendar.tasks.delete' })
  async deleteTask(@Payload() id: string) {
    console.log(`📥 [TCP] calendar.tasks.delete - id: ${id}`);
    return await this.calendarService.deleteTask(id);
  }

  @MessagePattern({ cmd: 'calendar.tasks.toggleComplete' })
  async toggleComplete(@Payload() id: string) {
    console.log(`📥 [TCP] calendar.tasks.toggleComplete - id: ${id}`);
    return await this.calendarService.toggleComplete(id);
  }

  // ==================== TAREAS CON FOTO ====================

  @MessagePattern({ cmd: 'calendar.tasks.completeWithPhoto' })
  async completeTaskWithPhoto(@Payload() data: { id: string; completionPhotoUrl: string; completionNotes?: string }) {
    console.log(`📥 [TCP] calendar.tasks.completeWithPhoto - id: ${data.id}`);
    const completeDto: CompleteTaskDto = {
      completionPhotoUrl: data.completionPhotoUrl,
      completionNotes: data.completionNotes
    };
    return await this.calendarService.completeTaskWithPhoto(data.id, completeDto);
  }

  @MessagePattern({ cmd: 'calendar.tasks.today' })
  async getTodayTasks(@Payload() userId: string) {
    console.log(`📥 [TCP] calendar.tasks.today - userId: ${userId}`);
    return await this.calendarService.getTodayTasks(userId);
  }

  @MessagePattern({ cmd: 'calendar.tasks.pending' })
  async getPendingTasks(@Payload() userId: string) {
    console.log(`📥 [TCP] calendar.tasks.pending - userId: ${userId}`);
    return await this.calendarService.getPendingTasks(userId);
  }

  @MessagePattern({ cmd: 'calendar.tasks.completedWithPhoto' })
  async getCompletedTasksWithPhoto(@Payload() userId: string) {
    console.log(`📥 [TCP] calendar.tasks.completedWithPhoto - userId: ${userId}`);
    return await this.calendarService.getCompletedTasksWithPhoto(userId);
  }

  // ==================== REPORTES Y ESTADÍSTICAS ====================

  @MessagePattern({ cmd: 'calendar.report.user' })
  async getUserReport(@Payload() data: { userId: string; year: number; month: number }) {
    console.log(`📥 [TCP] calendar.report.user - userId: ${data.userId}`);
    return await this.calendarService.getUserReport(data.userId, data.year, data.month);
  }

  @MessagePattern({ cmd: 'calendar.stats.cleaning' })
  async getCleaningStats(@Payload() data: { userId: string; year: number; month: number }) {
    console.log(`📥 [TCP] calendar.stats.cleaning - userId: ${data.userId}`);
    return await this.calendarService.getCleaningStats(data.userId, data.year, data.month);
  }

  // ==================== TAREAS RELACIONADAS ====================

  @MessagePattern({ cmd: 'calendar.tasks.byBoard' })
  async getTasksByBoard(@Payload() boardId: string) {
    console.log(`📥 [TCP] calendar.tasks.byBoard - boardId: ${boardId}`);
    return await this.calendarService.getTasksByBoard(boardId);
  }

  @MessagePattern({ cmd: 'calendar.tasks.byTask' })
  async getTasksByTask(@Payload() taskId: string) {
    console.log(`📥 [TCP] calendar.tasks.byTask - taskId: ${taskId}`);
    return await this.calendarService.getTasksByTask(taskId);
  }

  @MessagePattern({ cmd: 'calendar.tasks.byDateRange' })
  async getTasksByDateRange(@Payload() data: { userId: string; startDate: string; endDate: string }) {
    console.log(`📥 [TCP] calendar.tasks.byDateRange - userId: ${data.userId}`);
    return await this.calendarService.getTasksByDateRange(
      data.userId,
      new Date(data.startDate),
      new Date(data.endDate),
    );
  }
}