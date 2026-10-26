import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Receipt } from './receipt.entity';
import { ReceiptLineSerial } from './receipt-line-serial.entity';

/**
 * Línea de un ingreso. Tiene dos bloques bien separados:
 *
 *  1. LADO COMPRA (lo que dice el documento del proveedor): costo, descuento e impuesto de compra.
 *     Nunca determina el precio ni la tarifa de venta.
 *  2. CONFIGURACIÓN DEL LOTE (lo que decide el negocio): precio de venta, garantía y banderas.
 *     Se precarga desde el producto y, al confirmar, se copia al lote (snapshot).
 *
 * Los montos de compra van SIN impuesto; el impuesto de compra se guarda aparte
 * (código y porcentaje tal como vienen en el documento, no es un catálogo).
 */
@Entity('receipt_lines')
@Index('uq_receipt_lines_receipt_line_no', ['receiptId', 'lineNo'], { unique: true })
@Index('idx_receipt_lines_product', ['productId'])
@Check('chk_receipt_lines_quantity', `"quantity" > 0`)
@Check('chk_receipt_lines_unit_cost', `"unit_cost" >= 0`)
@Check('chk_receipt_lines_discount', `"discount" >= 0`)
@Check('chk_receipt_lines_sale_price', `"sale_price" >= 0`)
@Check('chk_receipt_lines_warranty', `"warranty_days" >= 0`)
// Facturable en órdenes exige facturable en ventas
@Check('chk_receipt_lines_repair_requires_sales', `"billable_in_repair_orders" = false OR "billable_in_sales" = true`)
export class ReceiptLine {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'receipt_id', type: 'uuid' })
    receiptId!: string;

    @Column({ name: 'line_no', type: 'int' })
    lineNo!: number;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ type: 'int' })
    quantity!: number;

    // ───────── 1. Lado compra ─────────

    /** Costo unitario SIN impuesto. */
    @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
    unitCost!: string;

    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    discount!: string;

    /** Código del impuesto de compra tal como viene en el documento (opcional). */
    @Column({ name: 'purchase_tax_code', length: 10, nullable: true })
    purchaseTaxCode?: string;

    /** Porcentaje del impuesto de compra (ej. 15.00). Nulo = sin impuesto de compra. */
    @Column({ name: 'purchase_tax_rate', type: 'numeric', precision: 5, scale: 2, nullable: true })
    purchaseTaxRate?: string;

    // ───────── 2. Configuración que heredará el lote ─────────

    @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2 })
    salePrice!: string;

    @Column({ name: 'warranty_days', type: 'int', default: 0 })
    warrantyDays!: number;

    @Column({ name: 'has_tax', default: true })
    hasTax!: boolean;

    @Column({ name: 'price_includes_tax', default: true })
    priceIncludesTax!: boolean;

    @Column({ name: 'billable_in_sales', default: false })
    billableInSales!: boolean;

    @Column({ name: 'billable_in_repair_orders', default: false })
    billableInRepairOrders!: boolean;

    // ───────── Enlaces ─────────

    /** Código del proveedor usado para emparejar el producto (importación futura). Sin FK: la tabla aún no existe. */
    @Column({ name: 'supplier_product_code_id', type: 'uuid', nullable: true })
    supplierProductCodeId?: string;

    /** Lote generado al confirmar. Sin FK: stock no depende de ingresos. */
    @Column({ name: 'lot_id', type: 'uuid', nullable: true })
    lotId?: string;

    // ───────── Relaciones ─────────

    @ManyToOne(() => Receipt, (r) => r.lines, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receipt_id' })
    receipt!: Receipt;

    @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'product_id' })
    product!: Product;

    @OneToMany(() => ReceiptLineSerial, (s) => s.line, { cascade: true })
    serials!: ReceiptLineSerial[];
}