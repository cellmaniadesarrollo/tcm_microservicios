import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { Lot } from './lot.entity';

/**
 * Existencias de un lote en una sucursal. Clave primaria: (lote, sucursal).
 * Hoy cada lote nace con una sola fila (sucursal principal); las transferencias
 * futuras repartirán el lote en varias sucursales.
 * El área de uso NO forma parte del saldo: se consulta desde los usos del producto.
 *
 * available = on_hand - reserved
 */
@Entity('stock_balances')
@Index('idx_stock_balances_product_branch', ['companyId', 'productId', 'branchId'])
@Index('idx_stock_balances_branch', ['branchId'])
@Check('chk_stock_balances_on_hand', `"on_hand" >= 0`)
@Check('chk_stock_balances_reserved', `"reserved" >= 0 AND "reserved" <= "on_hand"`)
export class StockBalance {
    @PrimaryColumn({ name: 'lot_id', type: 'uuid' })
    lotId!: string;

    @PrimaryColumn({ name: 'branch_id', type: 'uuid' })
    branchId!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Copia del lote para consultar por producto sin join. */
    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ name: 'on_hand', type: 'int', default: 0 })
    onHand!: number;

    @Column({ type: 'int', default: 0 })
    reserved!: number;

    @ManyToOne(() => Lot, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lot_id' })
    lot!: Lot;

    @ManyToOne(() => BranchReplica)
    @JoinColumn({ name: 'branch_id' })
    branch!: BranchReplica;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}