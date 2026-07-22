// src/calendar/calendar-tcp.controller.ts
import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CalendarService } from './calendar.service';
import { CreateEmployeeTaskDto } from './dto/create-employee-task.dto';
import { UpdateEmployeeTaskDto } from './dto/update-employee-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { InternalAuthInterceptor } from '../interceptor/internal-auth.interceptor';

@Controller()
@UseInterceptors(InternalAuthInterceptor) // ← VALIDAR TOKEN INTERNO
export class CalendarTcpController {
  constructor(private readonly calendarService: CalendarService) {}

  // ==================== CRUD BÁSICO ====================

  @MessagePattern({ cmd: 'calendar.tasks.create' })
  async createTask(@Payload() data: { 
    dto: CreateEmployeeTaskDto; 
    user: { userId: string; companyId: string; branchId: string } 
  }) {
    console.log(`📥 [TCP] calendar.tasks.create - title: ${data.dto.title}`);
    
    // ✅ EXTRAER companyId DEL USUARIO
    const { dto, user } = data;
    const createDto: CreateEmployeeTaskDto = {
      ...dto,
      userId: user.userId, // ← FORZAR userId del token
      companyId: user.companyId, // ← FORZAR companyId del token
    };
    
    return await this.calendarService.createTask(createDto);
  }

  @MessagePattern({ cmd: 'calendar.tasks.findByUser' })
  async getTasksByUser(@Payload() data: { 
    userId: string; 
    year: number; 
    month: number;
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.findByUser - userId: ${data.userId}, year: ${data.year}, month: ${data.month}`);
    
    // ✅ FILTRAR POR companyId
    return await this.calendarService.getTasksByUser(
      data.userId, 
      data.user.companyId, // ← companyId DEL TOKEN
      { year: data.year, month: data.month }
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.findAllForMonth' })
  async getAllTasksForMonth(@Payload() data: { 
    year: number; 
    month: number; 
    userId?: string;
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.findAllForMonth - year: ${data.year}, month: ${data.month}`);
    
    // ✅ FILTRAR POR companyId
    return await this.calendarService.getAllTasksForMonth(
      data.user.companyId, // ← companyId DEL TOKEN
      { year: data.year, month: data.month, userId: data.userId }
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.update' })
  async updateTask(@Payload() data: { 
    id: string; 
    updateDto: UpdateEmployeeTaskDto;
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.update - id: ${data.id}`);
    const { id, updateDto, user } = data;
    return await this.calendarService.updateTask(id, user.companyId, updateDto);
  }

  @MessagePattern({ cmd: 'calendar.tasks.delete' })
  async deleteTask(@Payload() data: { 
    id: string; 
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.delete - id: ${data.id}`);
    return await this.calendarService.deleteTask(data.id, data.user.companyId);
  }

  @MessagePattern({ cmd: 'calendar.tasks.toggleComplete' })
  async toggleComplete(@Payload() data: { 
    id: string; 
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.toggleComplete - id: ${data.id}`);
    return await this.calendarService.toggleComplete(data.id, data.user.companyId);
  }

  @MessagePattern({ cmd: 'calendar.tasks.completeWithPhoto' })
  async completeTaskWithPhoto(@Payload() data: { 
    id: string; 
    completionPhotoUrl: string; 
    completionNotes?: string;
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.completeWithPhoto - id: ${data.id}`);
    const completeDto: CompleteTaskDto = {
      completionPhotoUrl: data.completionPhotoUrl,
      completionNotes: data.completionNotes
    };
    return await this.calendarService.completeTaskWithPhoto(
      data.id, 
      data.user.companyId, 
      completeDto
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.today' })
  async getTodayTasks(@Payload() data: { 
    userId: string; 
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.today - userId: ${data.userId}`);
    return await this.calendarService.getTodayTasks(
      data.userId, 
      data.user.companyId
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.pending' })
  async getPendingTasks(@Payload() data: { 
    userId: string; 
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.pending - userId: ${data.userId}`);
    return await this.calendarService.getPendingTasks(
      data.userId, 
      data.user.companyId
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.completedWithPhoto' })
  async getCompletedTasksWithPhoto(@Payload() data: { 
    userId: string; 
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.completedWithPhoto - userId: ${data.userId}`);
    return await this.calendarService.getCompletedTasksWithPhoto(
      data.userId, 
      data.user.companyId
    );
  }

  @MessagePattern({ cmd: 'calendar.report.user' })
  async getUserReport(@Payload() data: { 
    userId: string; 
    year: number; 
    month: number;
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.report.user - userId: ${data.userId}`);
    return await this.calendarService.getUserReport(
      data.userId, 
      data.user.companyId, 
      data.year, 
      data.month
    );
  }

  @MessagePattern({ cmd: 'calendar.stats.cleaning' })
  async getCleaningStats(@Payload() data: { 
    userId: string; 
    year: number; 
    month: number;
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.stats.cleaning - userId: ${data.userId}`);
    return await this.calendarService.getCleaningStats(
      data.userId, 
      data.user.companyId, 
      data.year, 
      data.month
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.byBoard' })
  async getTasksByBoard(@Payload() data: { 
    boardId: string; 
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.byBoard - boardId: ${data.boardId}`);
    return await this.calendarService.getTasksByBoard(
      data.boardId, 
      data.user.companyId
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.byTask' })
  async getTasksByTask(@Payload() data: { 
    taskId: string; 
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.byTask - taskId: ${data.taskId}`);
    return await this.calendarService.getTasksByTask(
      data.taskId, 
      data.user.companyId
    );
  }

  @MessagePattern({ cmd: 'calendar.tasks.byDateRange' })
  async getTasksByDateRange(@Payload() data: { 
    userId: string; 
    startDate: string; 
    endDate: string;
    user: { userId: string; companyId: string; branchId: string }
  }) {
    console.log(`📥 [TCP] calendar.tasks.byDateRange - userId: ${data.userId}`);
    return await this.calendarService.getTasksByDateRange(
      data.userId,
      data.user.companyId,
      new Date(data.startDate),
      new Date(data.endDate),
    );
  }
}