// order-payment.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { PaymentType } from './payment-type.entity';
import { PaymentMethod } from './payment-method.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

export enum CashFlowDirection {
    INGRESO = 'INGRESO',
    EGRESO = 'EGRESO',
}

@Entity('order_payments')
export class OrderPayment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
    order: Order;

    @Column()
    order_id: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    amount: number; // siempre positivo (el signo lo da flow_type)

    @Column({
        type: 'enum',
        enum: CashFlowDirection,
        default: CashFlowDirection.INGRESO,
    })
    flow_type: CashFlowDirection; // INGRESO = cliente paga al taller | EGRESO = taller paga al cliente

    @ManyToOne(() => PaymentType, { nullable: false, eager: true })
    @JoinColumn({ name: 'payment_type_id' })
    paymentType: PaymentType;

    @Column()
    payment_type_id: number; // FK a ADELANTO, PAGO_PARCIAL, PAGO_FINAL, PAGO_A_CLIENTE, DEVOLUCION...

    @ManyToOne(() => PaymentMethod, { nullable: true, eager: true })
    @JoinColumn({ name: 'payment_method_id' })
    paymentMethod: PaymentMethod | null;

    @Column({ nullable: true })
    payment_method_id: number | null;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    paid_at: Date;

    @ManyToOne(() => UserEmployeeCache, { nullable: true })
    @JoinColumn({ name: 'received_by_id' })
    receivedBy: UserEmployeeCache | null;

    @Column({ nullable: true })
    received_by_id: string | null;

    @Column({ length: 100, nullable: true })
    reference?: string; // # transacción, comprobante, etc.

    @Column({ type: 'text', nullable: true })
    observation?: string;

    @Column({ type: 'uuid' })
    company_id: string;

    @Column({ type: 'uuid' })
    branch_id: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}