import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plan } from './plan.entity';
import { Resource } from '../../catalogs/entities/resource.entity';
@Entity('plan_limits')
export class PlanLimit {
 @PrimaryGeneratedColumn()
  id: number;

  // 🔗 Plan al que pertenece el límite
  @ManyToOne(() => Plan, plan => plan.limits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  // 🔗 Recurso que se limita (users, branches, etc.)
  @ManyToOne(() => Resource, { nullable: false })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;

  // 🔢 Valor máximo permitido
  @Column({ type: 'int' })
  maxValue: number;
}
