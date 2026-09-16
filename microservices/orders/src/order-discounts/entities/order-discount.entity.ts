import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order-workflow/entities/order.entity';

export enum DiscountType {
    PORCENTAJE = 'PORCENTAJE',
    FIJO = 'FIJO',
}

@Entity('order_discounts')
export class OrderDiscount {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'order_id' })
    order_id: number;

    @ManyToOne(() => Order)
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column({ type: 'enum', enum: DiscountType })
    tipo: DiscountType;

    // Si tipo = PORCENTAJE, valor es 0-100. Si tipo = FIJO, valor es el monto en $.
    @Column('decimal', { precision: 10, scale: 2 })
    valor: number;

    @Column({ type: 'text' })
    motivo: string;

    @Column({ name: 'registrado_por_id' })
    registrado_por_id: string;

    @Column({ name: 'registrado_por_nombre', nullable: true })
    registrado_por_nombre: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt: Date | null;

    @Column({ name: 'deleted_por_id', type: 'varchar', nullable: true })
    deletedPorId: string | null;

    @Column({ name: 'deleted_por_nombre', type: 'varchar', nullable: true })
    deletedPorNombre: string | null;
}