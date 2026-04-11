// microservices\clients\src\billing\entities\customer-billing-data.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,   // ← Volvimos al id normal (autoincremental)
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { Customer } from '../../customers/entities/customer.entity';
import { BillingData } from './billing-data.entity';

@Index(['customer', 'billingData'], { unique: true })
@Entity('customer_billing_data')
export class CustomerBillingData {

  @PrimaryGeneratedColumn()          // ← ID normal de PostgreSQL (number)
  id: number;

  @ManyToOne(() => Customer, (c) => c.billingDataLinks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  customer: Customer;

  @ManyToOne(() => BillingData, (bd) => bd.customerLinks, {
    nullable: false,
    eager: true,
  })
  billingData: BillingData;          // ← Esta relación sí apunta al ObjectId (string)

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}