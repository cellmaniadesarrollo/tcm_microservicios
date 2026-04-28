//D:\Teamcellmania_backend\microservices\orders\src\order-findings\entities\finding-procedure.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';

import { OrderFinding } from './order-finding.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { Attachment } from './attachment.entity';

@Entity('finding_procedures')
@Index(['finding_id'])
export class FindingProcedure {

  @PrimaryGeneratedColumn()
  id: number;

  // 🔗 Hallazgo
  @ManyToOne(() => OrderFinding, f => f.procedures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'finding_id' })
  finding: OrderFinding;

  @Column()
  finding_id: number;

  @Column({ type: 'text' })
  description: string;
  // ♻ Soft delete
  @Column({ default: true })
  is_active: boolean;
  // 👁 Visible para cliente
  @Column({ default: true })
  is_public: boolean;

  // ⏱ Tiempo invertido
  @Column({ type: 'int', nullable: true })
  time_spent_minutes: number;

  // 💵 Costo
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  procedure_cost: number;

  // 🛡 Garantía
  @Column({ type: 'int', nullable: true })
  warranty_days: number;

  // ✔ Cliente aprobó
  @Column({ default: false })
  client_approved: boolean;

  // ✅ ¿Se solucionó?
  @Column({ default: false })
  was_solved: boolean;

  // 🔁 Seguimiento
  @Column({ default: false })
  requires_followup: boolean;

  @Column({ type: 'text', nullable: true })
  followup_notes: string;

  // 👨‍🔧 Técnico ejecutor
  @ManyToOne(() => UserEmployeeCache, { eager: true })
  @JoinColumn({ name: 'performed_by_id' })
  performedBy: UserEmployeeCache;

  @OneToMany(() => Attachment, att => att.procedure)
  attachments?: Attachment[];

  @Column()
  performed_by_id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
