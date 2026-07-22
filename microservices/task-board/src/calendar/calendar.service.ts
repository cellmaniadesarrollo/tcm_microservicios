// src/calendar/calendar.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, IsNull } from 'typeorm';
import { EmployeeTask } from './entities/employee-task.entity';
import { CreateEmployeeTaskDto } from './dto/create-employee-task.dto';
import { UpdateEmployeeTaskDto } from './dto/update-employee-task.dto';
import { GetMonthTasksDto } from './dto/get-month-tasks.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(EmployeeTask)
    private employeeTaskRepository: Repository<EmployeeTask>,
  ) {}

  // ==================== CRUD BÁSICO ====================

  async createTask(createDto: CreateEmployeeTaskDto): Promise<EmployeeTask> {
    const dueDate = new Date(createDto.dueDate);
    const task = this.employeeTaskRepository.create({
      ...createDto,
      companyId: createDto.companyId, 
      dueDate,
      dueTime: createDto.dueTime || null,
      day: dueDate.getDate(),
      month: dueDate.getMonth(),
      year: dueDate.getFullYear(),
    });

    return await this.employeeTaskRepository.save(task);
  }

  async getTasksByUser(userId: string, companyId: string, monthDto: GetMonthTasksDto): Promise<EmployeeTask[]> {
    const startDate = new Date(monthDto.year, monthDto.month, 1);
    const endDate = new Date(monthDto.year, monthDto.month + 1, 0);

    return await this.employeeTaskRepository.find({
      where: {
        userId,
        companyId,
        dueDate: Between(startDate, endDate),
      },
      order: { dueDate: 'ASC' },
    });
  }

  async getAllTasksForMonth(companyId: string, monthDto: GetMonthTasksDto): Promise<EmployeeTask[]> {
    const startDate = new Date(monthDto.year, monthDto.month, 1);
    const endDate = new Date(monthDto.year, monthDto.month + 1, 0);

    const whereCondition: any = {
      companyId,
      dueDate: Between(startDate, endDate),
    };

    if (monthDto.userId) {
      whereCondition.userId = monthDto.userId;
    }

    return await this.employeeTaskRepository.find({
      where: whereCondition,
      order: { dueDate: 'ASC', userId: 'ASC' },
    });
  }

  async updateTask(id: string, companyId: string, updateDto: UpdateEmployeeTaskDto): Promise<EmployeeTask> {
    const task = await this.employeeTaskRepository.findOne({ where: { id, companyId } });
    if (!task) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }

    if (updateDto.dueDate) {
      const newDate = new Date(updateDto.dueDate);
      task.day = newDate.getDate();
      task.month = newDate.getMonth();
      task.year = newDate.getFullYear();
      task.dueDate = newDate;
    }

    if (updateDto.dueTime !== undefined) {
      task.dueTime = updateDto.dueTime || null;
    }

    const { dueDate, dueTime, ...updateData } = updateDto;
    Object.assign(task, updateData);
    
    return await this.employeeTaskRepository.save(task);
  }

  async deleteTask(id: string, companyId: string): Promise<void> {
    const result = await this.employeeTaskRepository.delete({id, companyId});
    if (result.affected === 0) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }
  }

  async toggleComplete(id: string, companyId: string): Promise<EmployeeTask> {
    const task = await this.employeeTaskRepository.findOne({ where: { id, companyId } });
    if (!task) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }
    task.isCompleted = !task.isCompleted;
    return await this.employeeTaskRepository.save(task);
  }

  // ==================== TAREAS CON FOTO ====================

  async completeTaskWithPhoto(id: string, companyId: string, completeDto: CompleteTaskDto): Promise<EmployeeTask> {
    const task = await this.employeeTaskRepository.findOne({ where: { id, companyId } });
    if (!task) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }
    
    task.isCompleted = true;
    task.completedAt = new Date();
    task.completionNotes = completeDto.completionNotes || '';
    task.completionPhotoUrl = completeDto.completionPhotoUrl || '';
    
    return await this.employeeTaskRepository.save(task);
  }

  async getTodayTasks(userId: string, companyId: string): Promise<EmployeeTask[]> {
    const today = new Date();
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        companyId,
        day: today.getDate(),
        month: today.getMonth(),
        year: today.getFullYear(),
      },
      order: { dueDate: 'ASC' },
    });
  }

  async getPendingTasks(userId: string, companyId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        companyId,
        isCompleted: false,
      },
      order: { dueDate: 'ASC' },
    });
  }

  async getCompletedTasksWithPhoto(userId: string, companyId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        companyId,
        isCompleted: true,
        completionPhotoUrl: Not(IsNull()),
      },
      order: { completedAt: 'DESC' },
    });
  }

  // ==================== REPORTES Y ESTADÍSTICAS ====================

  async getUserReport(userId: string, companyId: string, year: number, month: number): Promise<any> {
    const tasks = await this.getTasksByUser(userId, companyId, { year, month });
    
    return {
      userId,
      companyId,
      year,
      month,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.isCompleted).length,
      pendingTasks: tasks.filter(t => !t.isCompleted).length,
      completionRate: tasks.length > 0 
        ? ((tasks.filter(t => t.isCompleted).length / tasks.length) * 100).toFixed(2)
        : 0,
      tasksByPriority: {
        alta: tasks.filter(t => t.priority === 'alta').length,
        media: tasks.filter(t => t.priority === 'media').length,
        baja: tasks.filter(t => t.priority === 'baja').length,
      },
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        isCompleted: t.isCompleted,
        priority: t.priority,
        day: t.day,
        hasPhoto: !!t.completionPhotoUrl,
        completedAt: t.completedAt,
      })),
    };
  }

  async getCleaningStats(userId: string, companyId: string, year: number, month: number): Promise<any> {
    const tasks = await this.getTasksByUser(userId, companyId, { year, month });
    const completedWithPhoto = tasks.filter(t => t.isCompleted && t.completionPhotoUrl);
    
    return {
      userId,
      companyId,
      year,
      month,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.isCompleted).length,
      pendingTasks: tasks.filter(t => !t.isCompleted).length,
      completedWithPhoto: completedWithPhoto.length,
      completionRate: tasks.length > 0 
        ? ((tasks.filter(t => t.isCompleted).length / tasks.length) * 100).toFixed(2)
        : 0,
      photoComplianceRate: tasks.length > 0
        ? ((completedWithPhoto.length / tasks.length) * 100).toFixed(2)
        : 0,
      tasksByDay: tasks.map(t => ({
        day: t.day,
        title: t.title,
        description: t.description,
        isCompleted: t.isCompleted,
        hasPhoto: !!t.completionPhotoUrl,
        completedAt: t.completedAt,
        photoUrl: t.completionPhotoUrl,
        notes: t.completionNotes,
      })),
    };
  }

  // ==================== TAREAS RELACIONADAS ====================

  async getTasksByBoard(boardId: string, companyId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: { relatedBoardId: boardId, companyId },
      order: { dueDate: 'ASC' },
    });
  }

  async getTasksByTask(taskId: string, companyId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: { relatedTaskId: taskId, companyId },
    });
  }

  async getTasksByDateRange(userId: string, companyId: string, startDate: Date, endDate: Date): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        companyId,
        dueDate: Between(startDate, endDate),
      },
      order: { dueDate: 'ASC' },
    });
  }
}