// order-extras/entities/order-extra-service.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Order } from '../../order-workflow/entities/order.entity';
import { OrderServiceType } from './order-service-type.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

@Entity('order_extra_services')
@Index(['company_id'])
export class OrderExtraService {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Order, (order) => order.extraServices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column()
  order_id!: number;

  // 🔒 Multitenant directo, igual que Order
  @Column({ type: 'uuid' })
  company_id!: string;

  @ManyToOne(() => OrderServiceType, { eager: true })
  @JoinColumn({ name: 'service_type_id' })
  serviceType!: OrderServiceType;

  @Column()
  service_type_id!: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  purchase_price?: number | null;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price!: number;

  @ManyToOne(() => UserEmployeeCache, { eager: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: UserEmployeeCache;

  @Column()
  created_by_id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}