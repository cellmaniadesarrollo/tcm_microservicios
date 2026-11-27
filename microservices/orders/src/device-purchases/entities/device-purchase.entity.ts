// device-purchases/entities/device-purchase.entity.ts
import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
    JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Device } from '../../devices/entities/device.entity';
import { Order } from '../../order-workflow/entities/order.entity';
import { DevicePurchasePayment } from './device-purchase-payment.entity';

export enum DevicePurchaseStatus {
    PENDING = 'PENDING',     // sin pagos (solo con parciales a futuro)
    PARTIAL = 'PARTIAL',
    PAID = 'PAID',
    CANCELLED = 'CANCELLED',
}

@Entity('device_purchases')
@Index(['company_id', 'createdAt'])
@Index('uq_device_purchase_active_order', ['order_id'], {
    unique: true,
    where: `"status" <> 'CANCELLED'`,
})
export class DevicePurchase {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'uuid' })
    company_id!: string;

    @ManyToOne(() => Device, { nullable: false })
    @JoinColumn({ name: 'device_id' })
    device!: Device;

    @Index()
    @Column()
    device_id!: number;

    @ManyToOne(() => Order, { nullable: false })
    @JoinColumn({ name: 'order_id' })
    order!: Order;

    @Column()
    order_id!: number;

    // Total acordado por el equipo
    @Column({ type: 'decimal', precision: 12, scale: 2 })
    total_amount!: string;

    @Column({ length: 3, default: 'USD' })
    currency!: string;

    @Column({
        type: 'enum',
        enum: DevicePurchaseStatus,
        default: DevicePurchaseStatus.PENDING,
    })
    status!: DevicePurchaseStatus;

    @Column()
    created_by_id!: string;

    @Column({ type: 'timestamptz', nullable: true })
    cancelled_at?: Date;

    @Column({ nullable: true })
    cancelled_by_id?: string;

    @Column({ type: 'text', nullable: true })
    cancel_reason?: string;

    @OneToMany(() => DevicePurchasePayment, (p) => p.purchase)
    payments!: DevicePurchasePayment[];

    @CreateDateColumn() createdAt!: Date;
    @UpdateDateColumn() updatedAt!: Date;
}