import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Receipt } from './receipt.entity';

/**
 * Línea de un ingreso. Tiene tres bloques:
 *
 *  1. LADO COMPRA (lo que dice el documento del proveedor): costo, descuento e impuesto de compra.
 *     Nunca determina el precio ni la tarifa de venta.
 *  2. CONFIGURACIÓN DEL LOTE (lo que decide el negocio): precio de venta, garantía y banderas.
 *     Se precarga desde el producto y se copia al lote al guardar (snapshot).
 *  3. DOCUMENTO DEL PROVEEDOR: código, descripción y cantidad originales, para auditar y aprender.
 *
 * affects_inventory = false: concepto del documento sin stock (transporte, servicio...).
 * No tiene producto, lote, precio de venta ni garantía; solo registra el gasto y suma a los totales.
 *
 * Los montos de compra van SIN impuesto; el impuesto de compra se guarda aparte
 * (código y porcentaje tal como vienen en el documento, no es un catálogo).
 * Los seriales/IMEI no se guardan aquí: viven en stock_units y stock_unit_serials
 * y se rastrean por lot.origin_id = receipt_lines.id.
 */
@Entity('receipt_lines')
@Index('uq_receipt_lines_receipt_line_no', ['receiptId', 'lineNo'], { unique: true })
@Index('idx_receipt_lines_product', ['productId'])
@Check('chk_receipt_lines_quantity', `"quantity" > 0`)
@Check('chk_receipt_lines_unit_cost', `"unit_cost" >= 0`)
@Check('chk_receipt_lines_discount', `"discount" >= 0`)
@Check('chk_receipt_lines_sale_price', `"sale_price" IS NULL OR "sale_price" >= 0`)
@Check('chk_receipt_lines_warranty', `"warranty_days" >= 0`)
// Facturable en órdenes exige facturable en ventas
@Check('chk_receipt_lines_repair_requires_sales', `"billable_in_repair_orders" = false OR "billable_in_sales" = true`)
// Con inventario: producto y precio obligatorios. Sin inventario: ni producto ni lote.
@Check(
    'chk_receipt_lines_inventory',
    `("affects_inventory" = true AND "product_id" IS NOT NULL AND "sale_price" IS NOT NULL)
  OR ("affects_inventory" = false AND "product_id" IS NULL AND "lot_id" IS NULL)`,
)
export class ReceiptLine {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'receipt_id', type: 'uuid' })
    receiptId!: string;

    @Column({ name: 'line_no', type: 'int' })
    lineNo!: number;

    /** false = concepto sin stock (transporte, servicio...). */
    @Column({ name: 'affects_inventory', default: true })
    affectsInventory!: boolean;

    /** Nulo cuando la línea no afecta inventario. */
    @Column({ name: 'product_id', type: 'uuid', nullable: true })
    productId?: string;

    /** Concepto de la línea. Obligatorio cuando no afecta inventario. */
    @Column({ length: 300, nullable: true })
    description?: string;

    @Column({ type: 'int' })
    quantity!: number;

    // ───────── 1. Lado compra ─────────

    /** Costo unitario SIN impuesto. */
    @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
    unitCost!: string;

    /** Descuento TOTAL de la línea (no por unidad). */
    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    discount!: string;

    /** Código del impuesto de compra tal como viene en el documento (opcional). */
    @Column({ name: 'purchase_tax_code', length: 10, nullable: true })
    purchaseTaxCode?: string;

    /** Porcentaje del impuesto de compra (ej. 15.00). Nulo = sin impuesto de compra. */
    @Column({ name: 'purchase_tax_rate', type: 'numeric', precision: 5, scale: 2, nullable: true })
    purchaseTaxRate?: string;

    // ───────── 2. Configuración que hereda el lote (solo con inventario) ─────────

    @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
    salePrice?: string;

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

    // ───────── 3. Lo que decía el documento del proveedor ─────────

    @Column({ name: 'supplier_code', length: 100, nullable: true })
    supplierCode?: string;

    @Column({ name: 'supplier_description', length: 300, nullable: true })
    supplierDescription?: string;

    /** Cantidad según el documento, en unidades del proveedor (ej. 1 caja). */
    @Column({ name: 'supplier_quantity', type: 'numeric', precision: 14, scale: 4, nullable: true })
    supplierQuantity?: string;

    // ───────── Enlaces ─────────

    /** Relación código del proveedor -> producto que se usó/aprendió. Sin FK: es un dato de auditoría. */
    @Column({ name: 'supplier_product_code_id', type: 'uuid', nullable: true })
    supplierProductCodeId?: string;

    /** Lote generado al guardar. Sin FK: stock no depende de ingresos. Nulo si no afecta inventario. */
    @Column({ name: 'lot_id', type: 'uuid', nullable: true })
    lotId?: string;

    // ───────── Relaciones ─────────

    @ManyToOne(() => Receipt, (r) => r.lines, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receipt_id' })
    receipt!: Receipt;

    @ManyToOne(() => Product, { onDelete: 'RESTRICT', nullable: true })
    @JoinColumn({ name: 'product_id' })
    product?: Product;
}