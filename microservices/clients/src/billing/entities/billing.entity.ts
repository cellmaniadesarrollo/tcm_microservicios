import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { IdentificationType } from '../../catalogs/entities/identificationType.entity';

const UppercaseTrim = {
  to(value: string) {
    return value?.trim().toUpperCase();
  },
  from(value: string) {
    return value;
  },
};

@Entity('customer_billing')
export class Billing {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Customer, (customer) => customer.billings, {
    onDelete: 'CASCADE',
  })
  customer: Customer;

  @Column({
    type: 'varchar',
    length: 200,
    transformer: UppercaseTrim,
  })
  businessName: string;

  @Column({ type: 'varchar', length: 20 })
  identification: string;

  @ManyToOne(() => IdentificationType, { eager: true, nullable: true })
  @JoinColumn({ name: 'identificationTypeId' })
  identificationType: IdentificationType | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  billingAddress: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  billingPhone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  billingEmail: string;

  // 🟦 FECHAS AUTOMÁTICAS
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}