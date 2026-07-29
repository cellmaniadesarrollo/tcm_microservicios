// order-delivery.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { CustomerCache } from '../../customers-events/entities/customer-cache.entity';
import { PaymentMethod } from './payment-method.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';

@Entity('order_deliveries')
export class OrderDelivery {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => Order, (order) => order.delivery, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column({ unique: true })
    order_id: number;

    @Column({ type: 'timestamp', nullable: true })
    delivered_at: Date;

    @ManyToOne(() => UserEmployeeCache, { nullable: true })
    @JoinColumn({ name: 'delivered_by_id' })
    deliveredBy: UserEmployeeCache | null;

    @Column({ nullable: true })
    delivered_by_id: string | null;

    // Relación con cliente si el receptor está registrado
    @ManyToOne(() => CustomerCache, { nullable: true, eager: true })
    @JoinColumn({ name: 'received_by_customer_id' })
    receivedByCustomer: CustomerCache | null;

    @Column({ nullable: true })
    received_by_customer_id: number | null;

    // Fallback para terceros no registrados o cuando no se relaciona
    @Column({ type: 'varchar', length: 150, nullable: true })
    received_by_name: string | null;

    @Column({ default: false })
    signature_collected: boolean;

    // Dirección del dinero en esta entrega
    @Column({ default: false })
    is_outgoing_payment: boolean; // false = cliente paga (ingreso) | true = taller paga (egreso)

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    amount: number | null; // monto del movimiento final (positivo siempre)

    @ManyToOne(() => PaymentMethod, { nullable: true, eager: true })
    @JoinColumn({ name: 'payment_method_id' })
    paymentMethod: PaymentMethod | null;

    @Column({ nullable: true })
    payment_method_id: number | null;

    @Column({ type: 'text', nullable: true })
    closure_observation: string | null;

    // Multi-tenant
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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}