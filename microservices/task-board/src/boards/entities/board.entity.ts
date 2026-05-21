import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  OneToMany 
} from 'typeorm';

export enum BoardVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
  TEAM = 'team'
}

export enum BoardStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

@Entity('boards')
export class Board {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ 
    type: 'enum', 
    enum: BoardVisibility, 
    default: BoardVisibility.PRIVATE 
  })
  visibility: BoardVisibility;

  @Column({ 
    type: 'enum', 
    enum: BoardStatus, 
    default: BoardStatus.ACTIVE 
  })
  status: BoardStatus;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'simple-array', nullable: true })
  members: string[];

  @Column({ type: 'simple-array', nullable: true })
  admins: string[];

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: {
    allowComments?: boolean;
    allowAttachments?: boolean;
    defaultTaskView?: 'list' | 'board' | 'calendar';
    colorScheme?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'archived_at', nullable: true })
  archivedAt: Date;
}