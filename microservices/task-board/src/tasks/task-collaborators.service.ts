// tasks/task-collaborators.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskCollaborator } from './entities/task-collaborator.entity';
import { Task } from './entities/task.entity';

@Injectable()
export class TaskCollaboratorsService {
  constructor(
    @InjectRepository(TaskCollaborator)
    private collaboratorRepository: Repository<TaskCollaborator>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  async addCollaborator(taskId: string, userId: string, addedBy: string): Promise<TaskCollaborator> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const existing = await this.collaboratorRepository.findOne({
      where: { taskId, userId, active: true }
    });

    if (existing) {
      throw new BadRequestException(`User ${userId} is already a collaborator`);
    }

    const collaborator = this.collaboratorRepository.create({
      taskId,
      userId,
      addedBy,
    });

    return this.collaboratorRepository.save(collaborator);
  }

  async addMultipleCollaborators(taskId: string, userIds: string[], addedBy: string): Promise<TaskCollaborator[]> {
    const results: TaskCollaborator[] = [];
    for (const userId of userIds) {
      const collaborator = await this.addCollaborator(taskId, userId, addedBy);
      results.push(collaborator);
    }
    return results;
  }

  async getCollaborators(taskId: string): Promise<TaskCollaborator[]> {
    return this.collaboratorRepository.find({
      where: { taskId, active: true },
      order: { addedAt: 'DESC' }
    });
  }

  // Obtener tareas donde un usuario es colaborador
  async getTasksByUser(userId: string): Promise<Task[]> {
    const collaborators = await this.collaboratorRepository.find({
      where: { userId, active: true },
      relations: { task: true }
    });

    return collaborators.map(c => c.task);
  }

  async removeCollaborator(taskId: string, userId: string): Promise<void> {
    const collaborator = await this.collaboratorRepository.findOne({
      where: { taskId, userId, active: true }
    });

    if (!collaborator) {
      throw new NotFoundException(`User ${userId} is not a collaborator`);
    }

    collaborator.active = false;
    await this.collaboratorRepository.save(collaborator);
  }

  async removeAllCollaborators(taskId: string): Promise<void> {
    await this.collaboratorRepository.update(
      { taskId },
      { active: false }
    );
  }

  async isCollaborator(taskId: string, userId: string): Promise<boolean> {
    const collaborator = await this.collaboratorRepository.findOne({
      where: { taskId, userId, active: true }
    });
    return !!collaborator;
  }
}