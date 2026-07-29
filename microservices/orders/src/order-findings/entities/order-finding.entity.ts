//microservices\orders\src\order-findings\entities\order-finding.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';

import { Order } from '../../order-workflow/entities/order.entity'
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { FindingProcedure } from './finding-procedure.entity';
import { Attachment } from './attachment.entity';

@Entity('order_findings')
@Index(['order_id'])
export class OrderFinding {

  @PrimaryGeneratedColumn()
  id: number;

  // 🔗 Orden
  @ManyToOne(() => Order, order => order.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;


  // ♻ Soft delete
  @Column({ default: true })
  is_active: boolean;

  @Column()
  order_id: number;

  @Column({ type: 'text' })
  description: string;

  // 👨‍🔧 Técnico que detectó
  @ManyToOne(() => UserEmployeeCache, { eager: true })
  @JoinColumn({ name: 'reported_by_id' })
  reportedBy: UserEmployeeCache;

  @Column()
  reported_by_id: string;

  @Column({ default: false })
  is_resolved: boolean;

  // 🔗 Procedimientos
  @OneToMany(() => FindingProcedure, p => p.finding)
  procedures: FindingProcedure[];

  @OneToMany(() => Attachment, att => att.finding)
  attachments?: Attachment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
