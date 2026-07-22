// src/calendar/entities/employee-task.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index // ← Importar Index para mejorar rendimiento
} from 'typeorm';

@Entity('employee_tasks')
@Index(['companyId', 'userId']) // ← Índice compuesto para búsquedas rápidas
@Index(['companyId', 'dueDate']) // ← Índice para filtros por fecha
export class EmployeeTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ✅ AGREGAR companyId - OBLIGATORIO
  @Column({ name: 'company_id', type: 'uuid', nullable: true, })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'due_time', type: 'time', nullable: true })
  dueTime: string | null;

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

  @Column({ name: 'completion_photo_url', nullable: true })
  completionPhotoUrl: string;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

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