import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { Lot } from './lot.entity';
import { UnitStatus } from '../enums/stock.enums';

/**
 * Unidad física de un producto serializado (equipos, IMEI, seriales).
 * El serial es único por empresa y producto.
 */
@Entity('stock_units')
@Index('uq_stock_units_serial', ['companyId', 'productId', 'serial'], { unique: true })
@Index('idx_stock_units_lot_status', ['lotId', 'status'])
@Index('idx_stock_units_branch_status', ['companyId', 'branchId', 'status'])
export class StockUnit {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ name: 'lot_id', type: 'uuid' })
    lotId!: string;

    @Column({ name: 'branch_id', type: 'uuid' })
    branchId!: string;

    /** Se guarda normalizado: sin espacios en los extremos y en mayúsculas. */
    @Column({ length: 100 })
    serial!: string;

    @Column({ type: 'enum', enum: UnitStatus, default: UnitStatus.AVAILABLE })
    status!: UnitStatus;

    @ManyToOne(() => Lot, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lot_id' })
    lot!: Lot;

    @ManyToOne(() => BranchReplica)
    @JoinColumn({ name: 'branch_id' })
    branch!: BranchReplica;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}