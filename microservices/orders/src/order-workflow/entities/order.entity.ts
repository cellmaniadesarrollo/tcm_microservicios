import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { OrderType } from '../../catalogs/entities/order-type.entity';
import { OrderPriority } from '../../catalogs/entities/order-priority.entity';
import { Device } from '../../devices/entities/device.entity';
import { CustomerCache } from '../../customers-events/entities/customer-cache.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';


import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { OrderStatus } from '../../catalogs/entities/order_status.entity';
import { OrderFinding } from '../../order-findings/entities/order-finding.entity';
import { OrderDelivery } from './order-delivery.entity';
import { OrderPayment } from './order-payment.entity';

@Entity('orders')
@Index(['company_id', 'order_number'], { unique: true }) // 🔐 único por empresa
@Index(['public_id'], { unique: true })
export class Order {
  @OneToOne(() => OrderDelivery, (delivery) => delivery.order, { nullable: true })
  delivery?: OrderDelivery;
  @OneToMany(() => OrderFinding, finding => finding.order)
  findings: OrderFinding[];

  @PrimaryGeneratedColumn()
  id: number; // 🔒 interno

  @Column({ type: 'uuid', unique: true, nullable: true })
  public_id: string; // 🌍 público
  // 🔢 Número secuencial por empresa
  @Column()
  order_number: number;
  // ------------------------------------
  // 📌 ESTADO ACTUAL DE LA ORDEN
  // ------------------------------------

  @ManyToOne(() => OrderStatus, { eager: true })
  @JoinColumn({ name: 'current_status_id' })
  currentStatus: OrderStatus;

  @Column()
  current_status_id: number;
  // 📅 Fecha de ingreso
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  entry_date: Date;
  // ------------------------------------
  // 🔐 MULTI-TENANT (OBLIGATORIO)
  // ------------------------------------

  @Column({ type: 'uuid' })
  company_id: string;

  @ManyToOne(() => CompanyReplica, { eager: true })
  @JoinColumn({ name: 'company_id' })
  company: CompanyReplica;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => BranchReplica, { eager: true })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchReplica;

  // ------------------------------------
  // 🔗 RELACIONES EXISTENTES
  // ------------------------------------

  @ManyToOne(() => OrderType, { eager: true })
  @JoinColumn({ name: 'order_type_id' })
  type: OrderType;

  @Column()
  order_type_id: number;

  @ManyToOne(() => OrderPriority, { eager: true })
  @JoinColumn({ name: 'order_priority_id' })
  priority: OrderPriority;

  @Column()
  order_priority_id: number;

  @ManyToOne(() => CustomerCache, { eager: true })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerCache;

  @Column()
  customer_id: number;

  @ManyToMany(() => UserEmployeeCache, { eager: true })
  @JoinTable({
    name: 'order_technicians',
    joinColumn: { name: 'order_id' },
    inverseJoinColumn: { name: 'technician_id' },
  })
  technicians: UserEmployeeCache[];

  @ManyToOne(() => UserEmployeeCache, { eager: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: UserEmployeeCache;

  @Column()
  created_by_id: string;

  @ManyToOne(() => Device, { nullable: true, eager: true })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ nullable: true })
  device_id: number;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'previous_order_id' })
  previousOrder: Order;

  @Column({ nullable: true })
  previous_order_id: number;

  @Column({ nullable: true })
  patron: string;

  @Column({ nullable: true })
  password: string;

  @Column({ default: false })
  revisadoAntes: boolean;

  @Column({ type: 'text' })
  detalleIngreso: string;
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimated_price?: number;
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


  @OneToMany(() => OrderPayment, (payment) => payment.order, { cascade: true })
  payments: OrderPayment[];
}
