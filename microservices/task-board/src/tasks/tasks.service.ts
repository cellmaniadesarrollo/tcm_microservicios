// tasks/tasks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskCollaboratorsService } from './task-collaborators.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    private collaboratorsService: TaskCollaboratorsService,
    private notificationsService: NotificationsService,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create(createTaskDto);
    const savedTask = await this.taskRepository.save(task);
    
    // Enviar notificación de tarea creada
    await this.notificationsService.emitTaskCreated(
      {
        id: savedTask.id,
        title: savedTask.title,
        description: savedTask.description,
        status: savedTask.status,
        priority: savedTask.priority,
        columnId: savedTask.columnId || undefined,
        columnName: createTaskDto.columnName,
      },
      savedTask.boardId,
      createTaskDto.companyId || '', // ✅ Convertir undefined a string vacío
      savedTask.createdBy,
      createTaskDto.userName || savedTask.createdBy,
      savedTask.assignedTo
    );
    
    return savedTask;
  }

  async findAll(): Promise<Task[]> {
    return this.taskRepository.find({
      relations: { collaborators: true }
    });
  }

  async findByBoard(boardId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { boardId },
      relations: { collaborators: true },
      order: { order: 'ASC', createdAt: 'DESC' }
    });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: { collaborators: true }
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async findByUser(userId: string): Promise<Task[]> {
    const tasks = await this.taskRepository.find({
      where: [
        { assignedTo: userId },
        { createdBy: userId },
      ],
      relations: { collaborators: true },
      order: { dueDate: 'ASC', priority: 'DESC' }
    });

    const collaboratorTasks = await this.collaboratorsService.getTasksByUser(userId);
    
    const allTasks = [...tasks, ...collaboratorTasks];
    const uniqueTasks = allTasks.filter((task, index, self) => 
      index === self.findIndex(t => t.id === task.id)
    );
    
    return uniqueTasks;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    
    // Registrar cambios para la notificación
    const changes: string[] = [];
    
    if (updateTaskDto.title && updateTaskDto.title !== task.title) {
      changes.push(`título: "${task.title}" → "${updateTaskDto.title}"`);
    }
    if (updateTaskDto.status && updateTaskDto.status !== task.status) {
      const statusMap: Record<string, string> = {
        'todo': 'Por Hacer',
        'in_progress': 'En Progreso',
        'review': 'En Revisión',
        'done': 'Completado'
      };
      changes.push(`estado: ${statusMap[task.status] || task.status} → ${statusMap[updateTaskDto.status] || updateTaskDto.status}`);
    }
    if (updateTaskDto.priority && updateTaskDto.priority !== task.priority) {
      changes.push(`prioridad: ${task.priority} → ${updateTaskDto.priority}`);
    }
    if (updateTaskDto.description && updateTaskDto.description !== task.description) {
      changes.push(`descripción actualizada`);
    }
    if (updateTaskDto.assignedTo && updateTaskDto.assignedTo !== task.assignedTo) {
      changes.push(`asignado actualizado`);
    }
    
    // Verificar si se está completando la tarea
    const wasCompleted = updateTaskDto.status === TaskStatus.DONE && task.status !== TaskStatus.DONE;
    
    Object.assign(task, updateTaskDto);
    
    if (wasCompleted) {
      task.completedAt = new Date();
    }
    
    const savedTask = await this.taskRepository.save(task);
    
    // Enviar notificaciones según el tipo de cambio
    if (wasCompleted) {
      await this.notificationsService.emitTaskCompleted(
        { id: savedTask.id, title: savedTask.title },
        savedTask.boardId,
        updateTaskDto.companyId || '', // ✅ Convertir undefined a string vacío
        updateTaskDto.updatedBy || savedTask.createdBy,
        updateTaskDto.userName || savedTask.createdBy
      );
    } else if (changes.length > 0) {
      await this.notificationsService.emitTaskUpdated(
        {
          id: savedTask.id,
          title: savedTask.title,
          status: savedTask.status,
          priority: savedTask.priority,
        },
        savedTask.boardId,
        updateTaskDto.companyId || '', // ✅ Convertir undefined a string vacío
        updateTaskDto.updatedBy || savedTask.createdBy,
        updateTaskDto.userName || savedTask.createdBy,
        changes
      );
    }
    
    return savedTask;
  }

  async remove(id: string, updateTaskDto?: UpdateTaskDto): Promise<void> {
    const task = await this.findOne(id);
    
    // Enviar notificación de eliminación
    await this.notificationsService.emitTaskDeleted(
      { id: task.id, title: task.title },
      task.boardId,
      updateTaskDto?.companyId || '', // ✅ Convertir undefined a string vacío
      updateTaskDto?.updatedBy || task.createdBy,
      updateTaskDto?.userName || task.createdBy
    );
    
    await this.collaboratorsService.removeAllCollaborators(id);
    await this.taskRepository.remove(task);
  }

  async moveTask(
    taskId: string, 
    columnId: string, 
    order: number, 
    fromColumnName?: string,
    toColumnName?: string,
    updateTaskDto?: UpdateTaskDto
  ): Promise<Task> {
    const task = await this.findOne(taskId);
    
    task.columnId = columnId;
    task.order = order;
    
    const savedTask = await this.taskRepository.save(task);
    
    // Enviar notificación si cambió de columna
    if (fromColumnName && toColumnName && fromColumnName !== toColumnName) {
      await this.notificationsService.emitTaskMoved(
        { id: savedTask.id, title: savedTask.title },
        savedTask.boardId,
        updateTaskDto?.companyId || '', // ✅ Convertir undefined a string vacío
        updateTaskDto?.updatedBy || savedTask.createdBy,
        updateTaskDto?.userName || savedTask.createdBy,
        fromColumnName,
        toColumnName
      );
    }
    
    return savedTask;
  }

  // ==================== MÉTODOS DE COLABORADORES ====================

  async addCollaborator(taskId: string, userId: string, addedBy: string) {
    return this.collaboratorsService.addCollaborator(taskId, userId, addedBy);
  }

  async addMultipleCollaborators(taskId: string, userIds: string[], addedBy: string) {
    return this.collaboratorsService.addMultipleCollaborators(taskId, userIds, addedBy);
  }

  async getCollaborators(taskId: string) {
    return this.collaboratorsService.getCollaborators(taskId);
  }

  async removeCollaborator(taskId: string, userId: string) {
    return this.collaboratorsService.removeCollaborator(taskId, userId);
  }
}