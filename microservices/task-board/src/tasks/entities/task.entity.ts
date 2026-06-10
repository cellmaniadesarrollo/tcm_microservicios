// tasks/entities/task.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { TaskCollaborator } from './task-collaborator.entity';
import { TaskComment } from './task-comment.entity';
import { SubTask } from './subtask.entity';
import { BoardColumn } from '../../boards/entities/board-column.entity';

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done'
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Column({ name: 'board_id' })
  boardId: string;

  @Column({ name: 'column_id', nullable: true, type: 'uuid' })
  columnId: string | null;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'due_date', nullable: true })
  dueDate: Date;

  @Column({ name: 'start_date', nullable: true })
  startDate: Date;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ name: 'estimated_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  estimatedHours: number;

  @Column({ name: 'actual_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  actualHours: number;

  @Column({ type: 'jsonb', nullable: true })
  attachments: {
    id: string;
    name: string;
    url: string;
    size: number;
    type: string;
    uploadedBy: string;
    uploadedAt: Date;
  }[];

  @Column({ name: 'parent_task_id', nullable: true })
  parentTaskId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  // Relaciones
  @OneToMany(() => TaskCollaborator, collaborator => collaborator.task)
  collaborators: TaskCollaborator[];

  @OneToMany(() => TaskComment, comment => comment.task)
  comments: TaskComment[];

  @OneToMany(() => SubTask, subtask => subtask.parentTask)
  subtasks: SubTask[];

  @ManyToOne(() => BoardColumn, column => column.tasks)
  @JoinColumn({ name: 'column_id' })
  column: BoardColumn;
}