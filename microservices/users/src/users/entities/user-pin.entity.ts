import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface PinHistoryItem {
  pinHash: string;
  changedAt: string;
  changedBy: string;
  reason: 'cambio_usuario' | 'reset_admin';
  ip?: string | null;
}

@Index(['companyId', 'active'])
@Entity('user_pins')
export class UserPin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Un PIN por usuario
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 100, name: 'company_id' })
  companyId!: string;

  @Column({ type: 'varchar', name: 'pin_hash' })
  pinHash!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history!: PinHistoryItem[];

  @Column({ type: 'timestamp', name: 'last_changed_at', default: () => 'CURRENT_TIMESTAMP' })
  lastChangedAt!: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}