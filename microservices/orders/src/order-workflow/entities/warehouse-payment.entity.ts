import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';
import { PaymentType } from './payment-type.entity';
import { PaymentMethod } from './payment-method.entity';
import { Order } from './order.entity';


export enum WarehousePaymentFlowType {
    INGRESO = 'INGRESO',
    EGRESO = 'EGRESO',
}

@Entity('warehouse_payments')
@Index(['order_id'])
export class WarehousePayment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column()
    order_id: number;

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'enum', enum: WarehousePaymentFlowType, default: WarehousePaymentFlowType.INGRESO })
    flow_type: WarehousePaymentFlowType;

    @ManyToOne(() => PaymentType)
    @JoinColumn({ name: 'payment_type_id' })
    paymentType: PaymentType;

    @Column()
    payment_type_id: number;

    @ManyToOne(() => PaymentMethod)
    @JoinColumn({ name: 'payment_method_id' })
    paymentMethod: PaymentMethod;

    @Column()
    payment_method_id: number;

    @Column({ type: 'timestamp', nullable: true })
    paid_at: Date;

    @Column()
    received_by_id: string;

    @Column({ nullable: true })
    reference?: string;

    @Column({ type: 'text', nullable: true })
    observation?: string;

    @Column()
    company_id: string;

    @Column()
    branch_id: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}