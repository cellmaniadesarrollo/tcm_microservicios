// src/calendar/entities/employee-task.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn 
} from 'typeorm';

@Entity('employee_tasks')
export class EmployeeTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ type: 'int' })
  day: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ 
    type: 'enum', 
    enum: ['alta', 'media', 'baja'],
    default: 'media'
  })
  priority: string;

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;

  // NUEVO: Para almacenar la URL de la foto de evidencia
  @Column({ name: 'completion_photo_url', nullable: true })
  completionPhotoUrl: string;

  // NUEVO: Fecha y hora de cuando se completó
  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  // NUEVO: Comentario adicional al completar
  @Column({ name: 'completion_notes', nullable: true })
  completionNotes: string;

  @Column({ name: 'related_board_id', nullable: true })
  relatedBoardId: string;

  @Column({ name: 'related_task_id', nullable: true })
  relatedTaskId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}