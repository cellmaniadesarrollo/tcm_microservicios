import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { Lot } from './lot.entity';
import { MovementType } from '../enums/stock.enums';

/**
 * Kardex. SOLO se insertan filas: nunca se editan ni se borran.
 * Las correcciones se hacen con un movimiento contrario.
 *
 * quantity -> con signo (+ entra, - sale). Para serializados hay un movimiento por unidad (quantity = ±1).
 * reference_type/reference_id -> documento que lo originó (ingreso, venta, orden...). Sin FK.
 */
@Entity('stock_movements')
@Index('idx_stock_movements_product_date', ['companyId', 'productId', 'occurredAt'])
@Index('idx_stock_movements_lot', ['lotId'])
@Index('idx_stock_movements_reference', ['referenceType', 'referenceId'])
@Check('chk_stock_movements_quantity', `"quantity" <> 0`)
export class StockMovement {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'branch_id', type: 'uuid' })
    branchId!: string;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ name: 'lot_id', type: 'uuid' })
    lotId!: string;

    /** Nulo si el producto no es serializado. Sin FK. */
    @Column({ name: 'unit_id', type: 'uuid', nullable: true })
    unitId?: string;

    @Column({ type: 'enum', enum: MovementType })
    type!: MovementType;

    @Column({ type: 'int' })
    quantity!: number;

    /** Copia del costo del lote al momento del movimiento. */
    @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
    unitCost!: string;

    @Column({ name: 'reference_type', length: 30, nullable: true })
    referenceType?: string;

    @Column({ name: 'reference_id', type: 'uuid', nullable: true })
    referenceId?: string;

    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @ManyToOne(() => Lot, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lot_id' })
    lot!: Lot;

    @ManyToOne(() => BranchReplica)
    @JoinColumn({ name: 'branch_id' })
    branch!: BranchReplica;

    @CreateDateColumn({ name: 'occurred_at' })
    occurredAt!: Date;
}