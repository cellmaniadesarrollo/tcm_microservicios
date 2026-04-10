import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, CreateDateColumn,
  Index,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { BillingData } from './billing-data.entity';

@Index(['customer', 'billingData'], { unique: true })
@Entity('customer_billing_data')
export class CustomerBillingData {

  @PrimaryGeneratedColumn()
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
  billingData: BillingData;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean; // solo uno por cliente debería ser true

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}