import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('task_labels')
export class TaskLabel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'label_id' })
  labelId: string;
}