// src/calendar/calendar-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { EmployeeTask } from './entities/employee-task.entity';

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    @InjectRepository(EmployeeTask)
    private employeeTaskRepository: Repository<EmployeeTask>,
  ) {}

  /**
   * Crear una tarea en el calendario desde datos proporcionados
   */
  async createTaskFromData(taskData: {
    userId: string;
    title: string;
    description?: string;
    dueDate: Date;
    relatedBoardId?: string;
    relatedTaskId?: string;
    priority?: string;
    isCompleted?: boolean;
  }): Promise<EmployeeTask> {
    const dueDate = new Date(taskData.dueDate);
    const task = this.employeeTaskRepository.create({
      userId: taskData.userId,
      title: taskData.title,
      description: taskData.description || '',
      dueDate: dueDate,
      day: dueDate.getDate(),
      month: dueDate.getMonth(),
      year: dueDate.getFullYear(),
      relatedBoardId: taskData.relatedBoardId,
      relatedTaskId: taskData.relatedTaskId,
      priority: (taskData.priority as any) || 'media',
      isCompleted: taskData.isCompleted || false,
    });

    return await this.employeeTaskRepository.save(task);
  }

  /**
   * Importar múltiples tareas al calendario
   */
  async importTasks(tasks: Array<{
    userId: string;
    title: string;
    description?: string;
    dueDate: Date;
    relatedBoardId?: string;
    relatedTaskId?: string;
    priority?: string;
    isCompleted?: boolean;
  }>): Promise<{ imported: number; errors: number }> {
    let imported = 0;
    let errors = 0;

    for (const taskData of tasks) {
      try {
        // Verificar si ya existe para evitar duplicados
        if (taskData.relatedTaskId) {
          const existing = await this.employeeTaskRepository.findOne({
            where: { 
              relatedTaskId: taskData.relatedTaskId, 
              userId: taskData.userId 
            }
          });
          if (existing) {
            this.logger.debug(`Tarea ${taskData.relatedTaskId} ya existe en calendario`);
            continue;
          }
        }

        await this.createTaskFromData(taskData);
        imported++;
      } catch (error) {
        errors++;
        this.logger.error(`Error importando tarea: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Sincronizar tarea existente (desde otro servicio)
   */
  async syncExistingTask(task: {
    id: string;
    title: string;
    description?: string;
    dueDate?: Date;
    boardId?: string;
    assigneeId?: string;
    priority?: string;
    status?: string;
  }, userId?: string): Promise<EmployeeTask | null> {
    try {
      if (!task.dueDate) {
        this.logger.warn(`Tarea ${task.id} no tiene fecha de vencimiento`);
        return null;
      }

      // Determinar el userId (usar el proporcionado o el assigneeId de la tarea)
      const targetUserId = userId || task.assigneeId;
      
      if (!targetUserId) {
        this.logger.warn(`Tarea ${task.id} no tiene usuario asignado`);
        return null;
      }

      // Verificar si ya existe
      const existing = await this.employeeTaskRepository.findOne({
        where: { relatedTaskId: task.id, userId: targetUserId }
      });

      if (existing) {
        // Actualizar existente
        existing.title = task.title;
        existing.description = task.description || '';
        existing.dueDate = task.dueDate;
        existing.day = task.dueDate.getDate();
        existing.month = task.dueDate.getMonth();
        existing.year = task.dueDate.getFullYear();
        existing.priority = (task.priority as any) || existing.priority;
        existing.isCompleted = task.status === 'completed' || existing.isCompleted;
        
        return await this.employeeTaskRepository.save(existing);
      }

      // Crear nueva
      return await this.createTaskFromData({
        userId: targetUserId,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        relatedBoardId: task.boardId,
        relatedTaskId: task.id,
        priority: task.priority,
        isCompleted: task.status === 'completed',
      });
    } catch (error) {
      this.logger.error(`Error sincronizando tarea ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Eliminar tareas del calendario por ID de tarea relacionada
   */
  async removeTasksByRelatedId(relatedTaskId: string): Promise<number> {
    try {
      const result = await this.employeeTaskRepository.delete({ relatedTaskId });
      return result.affected || 0;
    } catch (error) {
      this.logger.error(`Error eliminando tareas relacionadas: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  /**
   * Obtener estadísticas de sincronización
   */
  async getSyncStats(): Promise<{
    total: number;
    synced: number;
    notSynced: number;
  }> {
    try {
      const total = await this.employeeTaskRepository.count();
      const synced = await this.employeeTaskRepository.count({
        where: { relatedTaskId: Not(IsNull()) }
      });

      return {
        total,
        synced,
        notSynced: total - synced,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { total: 0, synced: 0, notSynced: 0 };
    }
  }

  /**
   * Obtener todas las tareas sincronizadas
   */
  async getSyncedTasks(): Promise<EmployeeTask[]> {
    return await this.employeeTaskRepository.find({
      where: { relatedTaskId: Not(IsNull()) },
      order: { dueDate: 'ASC' }
    });
  }
}