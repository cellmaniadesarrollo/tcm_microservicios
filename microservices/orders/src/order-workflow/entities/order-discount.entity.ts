// order-discount.entity.ts
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
import { Order } from './order.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

export enum DiscountType {
    FIXED = 'FIXED',
    PERCENTAGE = 'PERCENTAGE',
}

export enum DiscountStatus {
    PENDING = 'PENDING',     // creado, aún no se ha calculado/congelado
    APPLIED = 'APPLIED',     // congelado al momento del cierre
    CANCELLED = 'CANCELLED', // anulado antes de llegar al cierre
}

@Entity('order_discounts')
@Index(['order_id', 'status'])
export class OrderDiscount {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, (order) => order.discounts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column()
    order_id: number;

    @Column({ type: 'enum', enum: DiscountType })
    discount_type: DiscountType;

    // Valor tal cual lo ingresan: 10.00 (fijo) o 15.00 (=15%)
    @Column({ type: 'decimal', precision: 12, scale: 2 })
    discount_value: number;

    // Null mientras está PENDING. Se llena al congelarse en el cierre.
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    calculated_amount: number | null;

    @Column({
        type: 'enum',
        enum: DiscountStatus,
        default: DiscountStatus.PENDING,
    })
    status: DiscountStatus;

    @Column({ type: 'text', nullable: true })
    reason?: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'created_by_id' })
    createdBy: UserEmployeeCache;

    @Column()
    created_by_id: string;

    // Quién lo canceló, si aplica
    @ManyToOne(() => UserEmployeeCache, { nullable: true })
    @JoinColumn({ name: 'cancelled_by_id' })
    cancelledBy: UserEmployeeCache | null;

    @Column({ nullable: true })
    cancelled_by_id: string | null;

    @Column({ type: 'timestamp', nullable: true })
    applied_at: Date | null; // cuándo se congeló (= fecha de cierre)

    @Column({ type: 'uuid' })
    company_id: string;

    @Column({ type: 'uuid' })
    branch_id: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}