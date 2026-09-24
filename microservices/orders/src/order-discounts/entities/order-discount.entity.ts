// microservices/orders/src/order-discounts/entities/order-discount.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { Order } from '../../order-workflow/entities/order.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

export enum DiscountType {
    FIXED = 'FIXED',
    PERCENTAGE = 'PERCENTAGE',
}

export enum DiscountStatus {
    PENDING = 'PENDING',
    APPLIED = 'APPLIED',
    CANCELLED = 'CANCELLED',
}

@Entity('order_discounts')
@Index(['order_id', 'status'])
export class OrderDiscount {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => Order, (order) => order.discounts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order!: Order;

    @Column()
    order_id!: number;

    @Column({ type: 'enum', enum: DiscountType })
    discount_type!: DiscountType;

    // Valor tal cual lo ingresan: 10.00 (FIXED) o 15.00 (=15% si PERCENTAGE)
    @Column({ type: 'decimal', precision: 12, scale: 2 })
    discount_value!: number;

    // Null mientras está PENDING. Se congela con el monto real al cerrar la orden.
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    calculated_amount?: number | null;

    @Column({ type: 'enum', enum: DiscountStatus, default: DiscountStatus.PENDING })
    status!: DiscountStatus;

    @Column({ type: 'text', nullable: true })
    reason?: string | null;

    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'created_by_id' })
    createdBy!: UserEmployeeCache;

    @Column()
    created_by_id!: string;

    @ManyToOne(() => UserEmployeeCache, { nullable: true })
    @JoinColumn({ name: 'cancelled_by_id' })
    cancelledBy?: UserEmployeeCache | null;

    @Column({ nullable: true })
    cancelled_by_id?: string | null;

    // Fecha en que se congeló el monto (= fecha de cierre de la orden)
    @Column({ type: 'timestamp', nullable: true })
    applied_at?: Date | null;

    @Column({ type: 'uuid' })
    company_id!: string;

    @Column({ type: 'uuid' })
    branch_id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'text', nullable: true })
    cancelled_reason?: string | null;

    @Column({ type: 'timestamp', nullable: true })
    cancelled_at?: Date | null;
}