import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('billing_cycles')
export class BillingCycle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // monthly | yearly

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;
}
