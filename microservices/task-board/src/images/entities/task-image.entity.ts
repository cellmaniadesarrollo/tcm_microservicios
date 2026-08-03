// src/images/entities/task-image.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('task_images') 
@Index(['taskId'])
@Index(['taskDetailId'])
export class TaskImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'uuid', nullable: true })
  taskDetailId: string | null;

  @Column({ type: 'text' })
  key: string; // La key de S3

  @Column()
  originalName: string;

  @Column()
  size: number;

  @Column()
  mimeType: string;

  @CreateDateColumn()
  createdAt: Date;
}