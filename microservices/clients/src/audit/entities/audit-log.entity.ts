import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index(['companyId', 'entity', 'entityId'])
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  // Sistema desde el que se hizo la acción
  @Column({ type: 'varchar', length: 20, default: 'BILLING' })
  source!: 'BILLING' | 'ORDERS';

  @Column({ type: 'varchar', length: 50 })
  entity!: string; // 'Customer', 'BillingData', etc.

  // varchar porque Customer usa número (44) y BillingData usa ObjectId (24 caracteres)
  @Column({ type: 'varchar', length: 100 })
  entityId!: string;

  @Column({ type: 'varchar', length: 10 })
  action!: 'CREATE' | 'UPDATE' | 'DELETE';

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  userName!: string | null;

  // varchar para que funcione igual si el companyId es número o string
  @Column({ type: 'varchar', length: 100, nullable: true })
  companyId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes!: Record<string, { old: any; new: any }> | null;

  @Column({ name: 'signed_by_user_id', type: 'varchar', length: 64, nullable: true })
  signedByUserId!: string | null;

  @Column({ name: 'signed_by_username', type: 'varchar', length: 100, nullable: true })
  signedByUsername!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}