import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { Product } from '../../products/entities/product.entity';
import { LotOriginType } from '../enums/stock.enums';

/**
 * Lote = copia fija (snapshot) de las condiciones comerciales con que entró una cantidad de un producto.
 * Se crea al confirmar un ingreso. NO guarda existencias (viven en stock_balances / stock_units).
 *
 * Desde aquí leen ventas, órdenes de reparación y facturación; nunca desde el producto.
 * Un lote confirmado no se edita con CRUD: las banderas solo cambian con una operación
 * explícita de "regularizar" (con auditoría).
 *
 * code -> correlativo por empresa; es lo que codifica el QR de la etiqueta.
 * Los montos son SIN impuesto de compra. La tarifa de venta la decide facturación.
 */
@Entity('lots')
@Index('uq_lots_company_code', ['companyId', 'code'], { unique: true })
@Index('idx_lots_company_product', ['companyId', 'productId'])
@Index('idx_lots_origin', ['originType', 'originId'])
// Facturable en órdenes exige facturable en ventas
@Check('chk_lots_repair_requires_sales', `"billable_in_repair_orders" = false OR "billable_in_sales" = true`)
@Check('chk_lots_quantity_positive', `"quantity_received" > 0`)
@Check('chk_lots_unit_cost_nonneg', `"unit_cost" >= 0`)
@Check('chk_lots_sale_price_nonneg', `"sale_price" >= 0`)
@Check('chk_lots_warranty_nonneg', `"warranty_days" >= 0`)
export class Lot {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ type: 'int', update: false })
    code!: number;

    /** Quién originó el lote. originId = id de la línea de ingreso (sin FK). */
    @Column({ name: 'origin_type', type: 'enum', enum: LotOriginType, update: false })
    originType!: LotOriginType;

    @Column({ name: 'origin_id', type: 'uuid', nullable: true, update: false })
    originId?: string;

    @Column({ name: 'quantity_received', type: 'int', update: false })
    quantityReceived!: number;

    /** Costo unitario SIN impuesto. */
    @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 4 })
    unitCost!: string;

    @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2 })
    salePrice!: string;

    @Column({ name: 'warranty_days', type: 'int', default: 0 })
    warrantyDays!: number;

    // ───────── Datos que necesita facturación (no se calcula nada aquí) ─────────

    @Column({ name: 'has_tax', default: true })
    hasTax!: boolean;

    /** true = el precio de venta ya incluye el impuesto. */
    @Column({ name: 'price_includes_tax', default: true })
    priceIncludesTax!: boolean;

    /** true = la venta de este lote se factura sí o sí. */
    @Column({ name: 'billable_in_sales', default: false })
    billableInSales!: boolean;

    /** true = se puede facturar al consumirse en una orden. Exige billable_in_sales. */
    @Column({ name: 'billable_in_repair_orders', default: false })
    billableInRepairOrders!: boolean;

    /** Usuario que lo creó (réplica de usuarios, sin FK). */
    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'product_id' })
    product!: Product;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}