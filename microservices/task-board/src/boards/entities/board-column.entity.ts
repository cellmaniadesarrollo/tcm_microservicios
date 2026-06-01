// boards/entities/board-column.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { Board } from './board.entity';
import { Task } from '../../tasks/entities/task.entity';

@Entity('board_columns')
export class BoardColumn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'board_id' })
  boardId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 7, nullable: true, default: '#E2E8F0' })
  color: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ name: 'wip_limit', nullable: true })
  wipLimit: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Board, board => board.columnsList)
  @JoinColumn({ name: 'board_id' })
  board: Board;

  // ✅ Relación OneToMany con tareas
  @OneToMany(() => Task, task => task.column)
  tasks: Task[];
}