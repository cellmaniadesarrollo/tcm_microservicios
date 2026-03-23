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

@Entity('order_notes')
@Index(['order_id', 'createdAt'])
export class OrderNote {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, (order) => order.notes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column()
    order_id: number;

    // Quién escribió la nota
    @ManyToOne(() => UserEmployeeCache, { eager: true, nullable: false })
    @JoinColumn({ name: 'created_by_id' })
    createdBy: UserEmployeeCache;

    @Column()
    created_by_id: string; // uuid del técnico/empleado

    // El contenido de la nota
    @Column({ type: 'text', nullable: false })
    note: string;

    @Column({ default: false })
    is_public: boolean;

    // Borrado lógico
    @Column({ default: false })
    isDeleted: boolean;

    // Fecha en que se marcó como eliminada (útil para auditoría)
    @Column({ type: 'timestamp', nullable: true })
    deletedAt?: Date | null;

    // Auditoría básica
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}