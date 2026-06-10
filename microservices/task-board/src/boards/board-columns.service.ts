// boards/board-columns.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';  // ✅ Agregar In
import { Board } from './entities/board.entity';
import { BoardColumn } from './entities/board-column.entity';
import { CreateColumnDto, UpdateColumnDto, MoveTaskDto } from './dto/column.dto';
import { Task } from '../tasks/entities/task.entity';

@Injectable()
export class BoardColumnsService {
  constructor(
    @InjectRepository(Board)
    private boardRepository: Repository<Board>,
    @InjectRepository(BoardColumn)
    private columnRepository: Repository<BoardColumn>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  // Configurar columnas por defecto
  async setupDefaultColumns(boardId: string): Promise<BoardColumn[]> {
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found`);
    }

    const defaultColumns = [
      { name: '📋 Backlog', color: '#94A3B8', order: 0, wipLimit: undefined },
      { name: '📝 To Do', color: '#3B82F6', order: 1, wipLimit: undefined },
      { name: '🚧 In Progress', color: '#F59E0B', order: 2, wipLimit: 5 },
      { name: '👀 In Review', color: '#8B5CF6', order: 3, wipLimit: 3 },
      { name: '✅ Done', color: '#10B981', order: 4, wipLimit: undefined },
    ];

    const savedColumns: BoardColumn[] = [];
    for (const colData of defaultColumns) {
      const column = this.columnRepository.create({
        boardId,
        ...colData,
      });
      const saved = await this.columnRepository.save(column);
      savedColumns.push(saved);
    }

    return savedColumns;
  }

  // Obtener columnas de un board
  async getColumns(boardId: string): Promise<BoardColumn[]> {
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found`);
    }
    return this.columnRepository.find({
      where: { boardId, active: true },
      order: { order: 'ASC' }
    });
  }

  // Obtener una columna específica con sus tareas
  async getColumnWithTasks(columnId: string): Promise<BoardColumn> {
    const column = await this.columnRepository.findOne({
      where: { id: columnId, active: true },
      relations: { tasks: true }  // ✅ Cambiar 'tasks' por el nombre correcto de la relación
    });
    if (!column) {
      throw new NotFoundException(`Column with ID ${columnId} not found`);
    }
    return column;
  }

  // Obtener una columna específica
  async getColumn(columnId: string): Promise<BoardColumn> {
    const column = await this.columnRepository.findOne({ where: { id: columnId, active: true } });
    if (!column) {
      throw new NotFoundException(`Column with ID ${columnId} not found`);
    }
    return column;
  }

  // Agregar nueva columna
  async addColumn(boardId: string, createColumnDto: CreateColumnDto): Promise<BoardColumn> {
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found`);
    }

    const column = this.columnRepository.create({
      boardId,
      name: createColumnDto.name,
      color: createColumnDto.color || '#E2E8F0',
      order: createColumnDto.order,
      wipLimit: createColumnDto.wipLimit,
    });

    return this.columnRepository.save(column);
  }

  // Actualizar columna
  async updateColumn(columnId: string, updateColumnDto: UpdateColumnDto): Promise<BoardColumn> {
    const column = await this.getColumn(columnId);
    Object.assign(column, updateColumnDto);
    return this.columnRepository.save(column);
  }

  // Eliminar columna
  async removeColumn(columnId: string): Promise<void> {
    const column = await this.getColumn(columnId);
    
    // Limpiar columnId de todas las tareas que estaban en esta columna
    await this.taskRepository.update(
      { columnId: columnId },
      { columnId: null }
    );
    
    column.active = false;
    await this.columnRepository.save(column);
  }

  // Eliminar todas las columnas de un board
  async removeAllColumns(boardId: string): Promise<void> {
    const columns = await this.columnRepository.find({ where: { boardId, active: true } });
    const columnIds = columns.map(c => c.id);
    
    // Limpiar columnId de todas las tareas
    if (columnIds.length > 0) {
      await this.taskRepository.update(
        { columnId: In(columnIds) },
        { columnId: null }
      );
    }
    
    await this.columnRepository.update(
      { boardId },
      { active: false }
    );
  }

  // Mover tarea entre columnas
  async moveTask(boardId: string, moveTaskDto: MoveTaskDto): Promise<void> {
    const toColumn = await this.getColumn(moveTaskDto.toColumnId);
    const task = await this.taskRepository.findOne({ where: { id: moveTaskDto.taskId } });

    if (!task) {
      throw new NotFoundException(`Task with ID ${moveTaskDto.taskId} not found`);
    }

    if (toColumn.wipLimit) {
      const tasksCount = await this.taskRepository.count({
        where: { columnId: moveTaskDto.toColumnId }
      });
      if (tasksCount >= toColumn.wipLimit) {
        throw new BadRequestException(`Column "${toColumn.name}" has reached its WIP limit of ${toColumn.wipLimit}`);
      }
    }

    // Actualizar la tarea con el nuevo columnId
    task.columnId = moveTaskDto.toColumnId;
    if (moveTaskDto.newOrder !== undefined) {
      task.order = moveTaskDto.newOrder;
    }
    await this.taskRepository.save(task);
  }

  // Reordenar columnas
  async reorderColumns(columnIds: string[]): Promise<void> {
    for (let i = 0; i < columnIds.length; i++) {
      await this.columnRepository.update(
        { id: columnIds[i] },
        { order: i }
      );
    }
  }

  // Agregar tarea a columna
  async addTaskToColumn(columnId: string, taskId: string): Promise<Task> {
    const column = await this.getColumn(columnId);
    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (column.wipLimit) {
      const tasksCount = await this.taskRepository.count({
        where: { columnId: columnId }
      });
      if (tasksCount >= column.wipLimit) {
        throw new BadRequestException(`Column "${column.name}" has reached its WIP limit of ${column.wipLimit}`);
      }
    }

    task.columnId = columnId;
    return this.taskRepository.save(task);
  }

  // Remover tarea de columna
  async removeTaskFromColumn(columnId: string, taskId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    task.columnId = null;
    return this.taskRepository.save(task);
  }

  // Obtener tareas de una columna
  async getTasksByColumn(columnId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { columnId },
      order: { order: 'ASC', createdAt: 'DESC' }
    });
  }
}