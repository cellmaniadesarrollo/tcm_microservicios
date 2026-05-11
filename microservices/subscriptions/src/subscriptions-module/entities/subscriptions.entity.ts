import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { Plan } from '../../plans/entities/plan.entity';
import { SubscriptionStatus } from '../../catalogs/entities/subscription-status.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('subscriptions')
@Index(['company'], { unique: true })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @ManyToOne(() => CompanyReplica, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: CompanyReplica;

  @ManyToOne(() => Plan, { nullable: false })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @ManyToOne(() => SubscriptionStatus, { nullable: false })
  @JoinColumn({ name: 'status_id' })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  // 🕒 Auditoría
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
