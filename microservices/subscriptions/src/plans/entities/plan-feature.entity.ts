import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plan } from './plan.entity';
import { Feature } from '../../catalogs/entities/feature.entity';
@Entity('plan_features')
export class PlanFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Plan, plan => plan.features, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @ManyToOne(() => Feature, { nullable: false })
  @JoinColumn({ name: 'feature_id' })
  feature: Feature;

  @Column()
  featureCode: string; // users | branches | inventory | billing

  @Column({ default: true })
  enabled: boolean;
}
