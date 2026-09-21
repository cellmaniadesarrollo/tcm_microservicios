// order-extras/entities/order-pending-product.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    Index,
} from 'typeorm';
import { Order } from '../../order-workflow/entities/order.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { PartRequest } from '../../order-part-request/entities/part-request.entity';

@Entity('order_pending_products')
@Index(['company_id'])
export class OrderPendingProduct {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column({
        type: 'enum',
        enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'LITIGIO'], // CAMBIO: se agrega LITIGIO
        default: 'PENDIENTE',
    })
    resultado_validacion!: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'LITIGIO';

    @Column({
        type: 'enum',
        enum: ['PRODUCTO_INCORRECTO', 'CALIDAD_DEFICIENTE', 'DAÑADO_EN_TRANSITO', 'CANTIDAD_INCOMPLETA', 'OTRO'],
        nullable: true,
    }) // NUEVO
    motivo_categoria?: 'PRODUCTO_INCORRECTO' | 'CALIDAD_DEFICIENTE' | 'DAÑADO_EN_TRANSITO' | 'CANTIDAD_INCOMPLETA' | 'OTRO';
    @ManyToOne(() => Order, (order) => order.pendingProducts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order!: Order;

    @Column()
    order_id!: number;

    // 🔒 Multitenant directo, igual que Order
    @Column({ type: 'uuid' })
    company_id!: string;

    @Column()
    name_items!: string;

    @Column({ nullable: true })
    id_brand?: number;

    @Column({ nullable: true })
    id_model?: number;

    @Column({ nullable: true })
    id_type?: number;

    @Column({ nullable: true })
    id_color?: number;

    @Column({ nullable: true })
    id_quality?: number;

    @Column({ type: 'text', nullable: true })
    observations?: string;

    @Column({ type: 'jsonb', nullable: true })
    extra_data?: Record<string, any>;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    sale_price!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    purchase_price?: number | null;

    @Column({ type: 'int', default: 1 })
    quantity!: number;

    @Column({ default: false })
    is_in_inventory!: boolean;

    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'created_by_id' })
    createdBy!: UserEmployeeCache;

    @Column({ type: 'int', nullable: true })
    part_request_id?: number | null;

    @ManyToOne(() => PartRequest, { nullable: true })
    @JoinColumn({ name: 'part_request_id' })
    partRequest?: PartRequest | null;

    @Column()
    created_by_id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}