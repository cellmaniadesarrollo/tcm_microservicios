// tasks/task-comments.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskComment } from './entities/task-comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class TaskCommentsService {
  constructor(
    @InjectRepository(TaskComment)
    private commentRepository: Repository<TaskComment>,
  ) {}

  /**
   * Crear un nuevo comentario
   */
  async create(createCommentDto: CreateCommentDto): Promise<TaskComment> {
    const comment = this.commentRepository.create(createCommentDto);
    return this.commentRepository.save(comment);
  }

  /**
   * Obtener todos los comentarios de una tarea
   */
  async findByTask(taskId: string): Promise<TaskComment[]> {
    return this.commentRepository.find({
      where: { taskId },
      order: { createdAt: 'ASC' }
    });
  }

  /**
   * Obtener un comentario por ID
   */
  async findOne(id: string): Promise<TaskComment> {
    const comment = await this.commentRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
    return comment;
  }

  /**
   * Actualizar un comentario
   */
  async update(id: string, updateCommentDto: UpdateCommentDto): Promise<TaskComment> {
    const comment = await this.findOne(id);
    comment.content = updateCommentDto.content;
    comment.edited = true;
    return this.commentRepository.save(comment);
  }

  /**
   * Eliminar un comentario
   */
  async delete(id: string): Promise<void> {
    const comment = await this.findOne(id);
    await this.commentRepository.remove(comment);
  }

  /**
   * Eliminar todos los comentarios de una tarea
   */
  async deleteAllByTask(taskId: string): Promise<void> {
    await this.commentRepository.delete({ taskId });
  }

  /**
   * Obtener comentarios por usuario
   */
  async findByUser(userId: string): Promise<TaskComment[]> {
    return this.commentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Obtener respuestas de un comentario
   */
  async getReplies(commentId: string): Promise<TaskComment[]> {
    return this.commentRepository.find({
      where: { parentCommentId: commentId },
      order: { createdAt: 'ASC' }
    });
  }
}