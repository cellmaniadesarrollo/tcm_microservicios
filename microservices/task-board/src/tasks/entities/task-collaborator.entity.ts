// tasks/entities/task-collaborator.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Task } from './task.entity';

@Entity('task_collaborators')
export class TaskCollaborator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'added_by', nullable: true })
  addedBy: string;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  @ManyToOne(() => Task, task => task.collaborators)  // Cambiar collaboratorsList a collaborators
  @JoinColumn({ name: 'task_id' })
  task: Task;
}