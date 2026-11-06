import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Lot } from '../../stock/entities/lot.entity';
import { Product } from '../../products/entities/product.entity';
import { StockVoucher } from './stock-voucher.entity';

/**
 * Línea del vale. Guarda un SNAPSHOT del lote al momento del movimiento:
 * si el lote se regulariza después, lo costeado/cobrado en la orden no cambia.
 * En retornos, origin_line_id apunta a la línea de salida que se devuelve
 * (y el snapshot se copia de ella).
 */
@Entity('stock_voucher_lines')
@Index('uq_stock_voucher_lines_voucher_no', ['voucherId', 'lineNo'], { unique: true })
@Index('idx_stock_voucher_lines_origin', ['originLineId'])
@Index('idx_stock_voucher_lines_product', ['productId'])
@Index('idx_stock_voucher_lines_lot', ['lotId'])
@Check('chk_stock_voucher_lines_quantity', `"quantity" > 0`)
export class StockVoucherLine {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'voucher_id', type: 'uuid' })
    voucherId!: string;

    @Column({ name: 'line_no', type: 'int' })
    lineNo!: number;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ name: 'lot_id', type: 'uuid' })
    lotId!: string;

    @Column({ type: 'int' })
    quantity!: number;

    // ── Snapshot del lote ──
    @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
    unitCost!: string;

    @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2 })
    salePrice!: string;

    @Column({ name: 'billable_in_sales', default: false })
    billableInSales!: boolean;

    @Column({ name: 'billable_in_repair_orders', default: false })
    billableInRepairOrders!: boolean;

    @Column({ name: 'origin_line_id', type: 'uuid', nullable: true })
    originLineId?: string | null;

    @ManyToOne(() => StockVoucher, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'voucher_id' })
    voucher!: StockVoucher;

    @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'product_id' })
    product!: Product;

    @ManyToOne(() => Lot, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'lot_id' })
    lot!: Lot;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;
}