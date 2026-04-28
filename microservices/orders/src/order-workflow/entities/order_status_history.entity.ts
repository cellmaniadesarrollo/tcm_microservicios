import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { Order } from './order.entity'; 
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { OrderStatus } from '../../catalogs/entities/order_status.entity';

@Entity('order_status_history')
export class OrderStatusHistory {

  @PrimaryGeneratedColumn()
  id: number;

  // -------------------------
  // 🔗 ORDEN
  // -------------------------
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  order_id: number;

  // -------------------------
  // 🔁 ESTADOS
  // -------------------------
  @ManyToOne(() => OrderStatus)
  @JoinColumn({ name: 'from_status_id' })
  fromStatus: OrderStatus;

  @Column({ nullable: true })
  from_status_id: number;

  @ManyToOne(() => OrderStatus)
  @JoinColumn({ name: 'to_status_id' })
  toStatus: OrderStatus;

  @Column()
  to_status_id: number;

  // -------------------------
  // 👤 QUIÉN CAMBIÓ
  // -------------------------
  @ManyToOne(() => UserEmployeeCache)
  @JoinColumn({ name: 'changed_by_id' })
  changedBy: UserEmployeeCache;

  @Column()
  changed_by_id: string;

  // -------------------------
  // 🔐 MULTI-TENANT
  // -------------------------
  @Column({ type: 'uuid' })
  company_id: string;

  @ManyToOne(() => CompanyReplica)
  @JoinColumn({ name: 'company_id' })
  company: CompanyReplica;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => BranchReplica)
  @JoinColumn({ name: 'branch_id' })
  branch: BranchReplica;

  // -------------------------
  // 📝 EXTRA
  // -------------------------
  @Column({ type: 'text', nullable: true })
  observation: string;

  @CreateDateColumn()
  changed_at: Date;
}
