// microservices\orders\src\order-workflow\entities\order-price-agreement.entity.ts
//
// ⚠️ IMPORTANTE: en order.entity.ts debes agregar el import y esta relación:
//
// import { OrderPriceAgreement } from './order-price-agreement.entity';
//
// @OneToMany(() => OrderPriceAgreement, (agreement) => agreement.order, { cascade: true })
// priceAgreements!: OrderPriceAgreement[];
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
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

/**
 * Registra el precio que se acordó/negoció con el cliente para una orden.
 * Guarda quién lo acordó, quién fue la última persona en editarlo,
 * y observaciones sobre la negociación.
 */
@Entity('order_price_agreements')
export class OrderPriceAgreement {
    @PrimaryGeneratedColumn()
    id!: number;

    // Relación con la orden a la que pertenece este acuerdo de precio
    @ManyToOne(() => Order, (order) => order.priceAgreements, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'order_id' })
    order!: Order;

    @Column()
    order_id!: number;

    // Precio acordado con el cliente
    @Column({
        type: 'decimal',
        precision: 10,
        scale: 2,
    })
    agreed_price!: number;

    // Quién convino (acordó) el precio con el cliente
    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'agreed_by_id' })
    agreedBy!: UserEmployeeCache;

    @Column()
    agreed_by_id!: string;

    // Observaciones sobre cómo/por qué se llegó a ese precio
    @Column({ type: 'text', nullable: true })
    observations?: string;

    // Quién fue la última persona en editar este registro
    @ManyToOne(() => UserEmployeeCache, { eager: true, nullable: true })
    @JoinColumn({ name: 'last_edited_by_id' })
    lastEditedBy?: UserEmployeeCache;

    @Column({ nullable: true })
    last_edited_by_id?: string;

    // Fecha de creación (cuando se registró el acuerdo)
    @CreateDateColumn()
    createdAt!: Date;

    // Fecha de la última edición
    @UpdateDateColumn()
    updatedAt!: Date;
}