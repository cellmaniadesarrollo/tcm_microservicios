// device-purchases/entities/device-purchase-payment.entity.ts
import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne,
    JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { DevicePurchase } from './device-purchase.entity';
import { PaymentMethod } from '../../order-workflow/entities/payment-method.entity';
import { PaymentType } from '../../order-workflow/entities/payment-type.entity';


@Entity('device_purchase_payments')
@Index(['company_id', 'paid_at'])
export class DevicePurchasePayment {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'uuid' })
    company_id!: string;

    @ManyToOne(() => DevicePurchase, (p) => p.payments, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'purchase_id' })
    purchase!: DevicePurchase;

    @Index()
    @Column()
    purchase_id!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    amount!: string;

    @ManyToOne(() => PaymentMethod, { nullable: false })
    @JoinColumn({ name: 'payment_method_id' })
    paymentMethod!: PaymentMethod;

    @Column()
    payment_method_id!: number;

    // Siempre 'PAGO_A_CLIENTE' (egreso); lo resuelve el servicio por código
    @ManyToOne(() => PaymentType, { nullable: false })
    @JoinColumn({ name: 'payment_type_id' })
    paymentType!: PaymentType;

    @Column()
    payment_type_id!: number;

    @Column({ length: 100, nullable: true })
    payment_reference?: string;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    paid_at!: Date;

    @Column()
    registered_by_id!: string;

    // Anulación lógica: no se borra el egreso
    @Column({ default: true })
    is_active!: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    voided_at?: Date;

    @Column({ nullable: true })
    voided_by_id?: string;

    @Column({ type: 'text', nullable: true })
    void_reason?: string;

    @CreateDateColumn() createdAt!: Date;
    @UpdateDateColumn() updatedAt!: Date;
}