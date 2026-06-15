// order-potential-purchase/entities/order-potential-purchase.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order-workflow/entities/order.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

@Entity('order_potential_purchases')
export class OrderPotentialPurchase {

    @PrimaryGeneratedColumn()
    id!: number;

    @OneToOne(() => Order)
    @JoinColumn({ name: 'order_id' })
    order!: Order;

    @Column()
    order_id!: number;

    // Siempre true cuando existe el registro, pero explícito para claridad
    @Column({ default: true })
    is_potential!: boolean;

    // Quién lo marcó
    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'marked_by_id' })
    markedBy!: UserEmployeeCache;

    @Column()
    marked_by_id!: string;

    // Observaciones opcionales para contexto futuro
    @Column({ type: 'text', nullable: true })
    observations?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}