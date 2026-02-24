import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { BillingCycle } from '../../catalogs/entities/billing-cycle.entity';
import { PlanFeature } from './plan-feature.entity';
import { PlanLimit } from './plan-limit.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => BillingCycle, { nullable: false })
  @JoinColumn({ name: 'billing_cycle_id' })
  billingCycle: BillingCycle;

  @Column({ default: true })
  active: boolean;

  // 🔒 Plan interno (OWNER / SYSTEM)
  @Column({ default: false })
  isInternal: boolean;

  // 🕒 Auditoría automática
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => PlanFeature, pf => pf.plan)
  features: PlanFeature[];

  @OneToMany(() => PlanLimit, pl => pl.plan)
  limits: PlanLimit[];
}
