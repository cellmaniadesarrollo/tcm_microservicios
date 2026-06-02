// tasks/entities/subtask.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Task } from './task.entity';

export enum SubTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE = 'done'
}

@Entity('subtasks')
export class SubTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parent_task_id' })
  parentTaskId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: SubTaskStatus, default: SubTaskStatus.PENDING })
  status: SubTaskStatus;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @Column({ name: 'due_date', nullable: true })
  dueDate: Date;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Task, task => task.subtasks)
  @JoinColumn({ name: 'parent_task_id' })
  parentTask: Task;
}