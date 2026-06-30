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
      dueDate,
      day: dueDate.getDate(),
      month: dueDate.getMonth(),
      year: dueDate.getFullYear(),
    });

    return await this.employeeTaskRepository.save(task);
  }

  async getTasksByUser(userId: string, monthDto: GetMonthTasksDto): Promise<EmployeeTask[]> {
    const startDate = new Date(monthDto.year, monthDto.month, 1);
    const endDate = new Date(monthDto.year, monthDto.month + 1, 0);

    return await this.employeeTaskRepository.find({
      where: {
        userId,
        dueDate: Between(startDate, endDate),
      },
      order: { dueDate: 'ASC' },
    });
  }

  async getAllTasksForMonth(monthDto: GetMonthTasksDto): Promise<EmployeeTask[]> {
    const startDate = new Date(monthDto.year, monthDto.month, 1);
    const endDate = new Date(monthDto.year, monthDto.month + 1, 0);

    const whereCondition: any = {
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

  async updateTask(id: string, updateDto: UpdateEmployeeTaskDto): Promise<EmployeeTask> {
    const task = await this.employeeTaskRepository.findOne({ where: { id } });
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

    const { dueDate, ...updateData } = updateDto;
    Object.assign(task, updateData);
    
    return await this.employeeTaskRepository.save(task);
  }

  async deleteTask(id: string): Promise<void> {
    const result = await this.employeeTaskRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }
  }

  async toggleComplete(id: string): Promise<EmployeeTask> {
    const task = await this.employeeTaskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }
    task.isCompleted = !task.isCompleted;
    return await this.employeeTaskRepository.save(task);
  }

  // ==================== TAREAS CON FOTO ====================

  async completeTaskWithPhoto(id: string, completeDto: CompleteTaskDto): Promise<EmployeeTask> {
    const task = await this.employeeTaskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }
    
    task.isCompleted = true;
    task.completedAt = new Date();
    task.completionNotes = completeDto.completionNotes || '';
    task.completionPhotoUrl = completeDto.completionPhotoUrl || '';
    
    return await this.employeeTaskRepository.save(task);
  }

  async getTodayTasks(userId: string): Promise<EmployeeTask[]> {
    const today = new Date();
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        day: today.getDate(),
        month: today.getMonth(),
        year: today.getFullYear(),
      },
      order: { dueDate: 'ASC' },
    });
  }

  async getPendingTasks(userId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        isCompleted: false,
      },
      order: { dueDate: 'ASC' },
    });
  }

  async getCompletedTasksWithPhoto(userId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        isCompleted: true,
        completionPhotoUrl: Not(IsNull()),
      },
      order: { completedAt: 'DESC' },
    });
  }

  // ==================== REPORTES Y ESTADÍSTICAS ====================

  async getUserReport(userId: string, year: number, month: number): Promise<any> {
    const tasks = await this.getTasksByUser(userId, { year, month });
    
    return {
      userId,
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

  async getCleaningStats(userId: string, year: number, month: number): Promise<any> {
    const tasks = await this.getTasksByUser(userId, { year, month });
    const completedWithPhoto = tasks.filter(t => t.isCompleted && t.completionPhotoUrl);
    
    return {
      userId,
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

  async getTasksByBoard(boardId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: { relatedBoardId: boardId },
      order: { dueDate: 'ASC' },
    });
  }

  async getTasksByTask(taskId: string): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: { relatedTaskId: taskId },
    });
  }

  async getTasksByDateRange(userId: string, startDate: Date, endDate: Date): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: {
        userId,
        dueDate: Between(startDate, endDate),
      },
      order: { dueDate: 'ASC' },
    });
  }
}