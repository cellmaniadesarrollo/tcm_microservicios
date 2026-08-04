// tasks/subtasks.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubTask, SubTaskStatus } from './entities/subtask.entity';
import { CreateSubTaskDto } from './dto/create-subtask.dto';
import { UpdateSubTaskDto } from './dto/update-subtask.dto';

@Injectable()
export class SubTasksService {
  constructor(
    @InjectRepository(SubTask)
    private subtaskRepository: Repository<SubTask>,
  ) {}

  /**
   * Crear una nueva subtarea
   */
  async create(createSubTaskDto: CreateSubTaskDto): Promise<SubTask> {
    const subtask = this.subtaskRepository.create(createSubTaskDto);
    return this.subtaskRepository.save(subtask);
  }

  /**
   * Obtener todas las subtareas de una tarea
   */
  async findByTask(taskId: string): Promise<SubTask[]> {
    return this.subtaskRepository.find({
      where: { parentTaskId: taskId },
      order: { order: 'ASC', createdAt: 'ASC' }
    });
  }

  /**
   * Obtener una subtarea por ID
   */
  async findOne(id: string): Promise<SubTask> {
    const subtask = await this.subtaskRepository.findOne({ where: { id } });
    if (!subtask) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }
    return subtask;
  }

  /**
   * Actualizar una subtarea
   */
  async update(id: string, updateSubTaskDto: UpdateSubTaskDto): Promise<SubTask> {
    const subtask = await this.findOne(id);
    Object.assign(subtask, updateSubTaskDto);
    return this.subtaskRepository.save(subtask);
  }

  /**
   * Eliminar una subtarea
   */
  async delete(id: string): Promise<void> {
    const subtask = await this.findOne(id);
    await this.subtaskRepository.remove(subtask);
  }

  /**
   * Eliminar todas las subtareas de una tarea
   */
  async deleteAllByTask(taskId: string): Promise<void> {
    await this.subtaskRepository.delete({ parentTaskId: taskId });
  }

  /**
   * Actualizar el estado de una subtarea
   */
  async updateStatus(id: string, status: SubTaskStatus): Promise<SubTask> {
    const subtask = await this.findOne(id);
    subtask.status = status;
    
    // Si la subtarea se completa, actualizar también la fecha de completado
    if (status === SubTaskStatus.DONE) {
      // Podrías agregar un campo completedAt si lo deseas
    }
    
    return this.subtaskRepository.save(subtask);
  }

  /**
   * Reordenar subtareas
   */
  async reorder(taskId: string, subtaskIds: string[]): Promise<void> {
    for (let i = 0; i < subtaskIds.length; i++) {
      await this.subtaskRepository.update(
        { id: subtaskIds[i], parentTaskId: taskId },
        { order: i }
      );
    }
  }

  /**
   * Mover subtarea a otra tarea padre
   */
  async moveToTask(subtaskId: string, newParentTaskId: string): Promise<SubTask> {
    const subtask = await this.findOne(subtaskId);
    subtask.parentTaskId = newParentTaskId;
    return this.subtaskRepository.save(subtask);
  }

  /**
   * Obtener subtareas asignadas a un usuario
   */
  async findByUser(userId: string): Promise<SubTask[]> {
    return this.subtaskRepository.find({
      where: { assignedTo: userId },
      order: { dueDate: 'ASC', createdAt: 'DESC' }
    });
  }

  /**
   * Obtener subtareas vencidas
   */
  async findOverdue(): Promise<SubTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.subtaskRepository.find({
      where: {
        dueDate: today,
        status: SubTaskStatus.PENDING
      },
      order: { dueDate: 'ASC' }
    });
  }

  /**
   * Obtener estadísticas de subtareas para una tarea
   */
  async getTaskSubtaskStats(taskId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    completionRate: number;
  }> {
    const subtasks = await this.findByTask(taskId);
    const total = subtasks.length;
    
    if (total === 0) {
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        completionRate: 0
      };
    }
    
    const pending = subtasks.filter(s => s.status === SubTaskStatus.PENDING).length;
    const inProgress = subtasks.filter(s => s.status === SubTaskStatus.IN_PROGRESS).length;
    const done = subtasks.filter(s => s.status === SubTaskStatus.DONE).length;
    const completionRate = Math.round((done / total) * 100);
    
    return {
      total,
      pending,
      inProgress,
      done,
      completionRate
    };
  }
}