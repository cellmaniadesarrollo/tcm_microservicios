import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Index, Check,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { ProductType } from '../../product-catalogs/entities/product-type.entity';
import { ProductName } from '../../product-catalogs/entities/product-name.entity';
import { Color } from '../../product-catalogs/entities/color.entity';
import { Quality } from '../../product-catalogs/entities/quality.entity';
import { ProductKind } from '../../common/enums/product-kind.enum';
import { TrackingMode } from '../enums/product.enums';
import { ProductModel } from './product-model.entity';
import { ProductImage } from './product-image.entity';
import { ProductUsageLink } from './product-usage-link.entity';

/**
 * Producto (SKU) = ficha de catálogo. No guarda existencias, costos ni
 * condiciones fiscales reales: eso vive en el lote, los saldos y las unidades.
 *
 * code -> correlativo numérico por empresa. Inmutable.
 * sku  -> {KIND}-{TIPO}-{MARCA}-{code con ceros}, ej: REP-BAT-SAM-000111. Inmutable.
 *
 * Los campos de la sección "Valores por defecto" solo PRECARGAN el ingreso.
 * Al confirmar un ingreso se copian al lote y desde ahí el lote manda.
 * Cambiarlos aquí no afecta lotes ya ingresados.
 *
 * Validaciones que se hacen en el servicio (no se pueden con CHECK):
 *  - Debe tener al menos un uso (usages).
 *  - kind debe coincidir con productType.kind.
 *  - Un DEVICE tiene exactamente un modelo compatible.
 *  - billableInRepairOrders = true exige billableInSales = true.
 */
@Entity('products')
@Index('uq_products_company_code', ['companyId', 'code'], { unique: true })
@Index('uq_products_company_sku', ['companyId', 'sku'], { unique: true })
@Index('uq_products_company_upc', ['companyId', 'upc'], {
    unique: true,
    where: '"upc" IS NOT NULL',
})
@Index('idx_products_company_type', ['companyId', 'productTypeId'])
@Index('idx_products_company_kind', ['companyId', 'kind'])
@Index('idx_products_company_name', ['companyId', 'productNameId'])
// Un equipo completo siempre es serializado
@Check('chk_products_device_serial', `"kind" <> 'DEVICE' OR "tracking_mode" = 'SERIAL'`)
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ type: 'int', update: false })
    code!: number;

    @Column({ length: 100, update: false })
    sku!: string;

    /** Código de barras del fabricante (si no viene, se usa el correlativo con ceros). */
    @Column({ length: 100, nullable: true })
    upc?: string;

    @Column({ name: 'product_name_id', type: 'uuid' })
    productNameId!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    /** Se copia del tipo al crear, para filtrar sin join. Debe coincidir con productType.kind. */
    @Column({ type: 'enum', enum: ProductKind })
    kind!: ProductKind;

    @Column({ name: 'tracking_mode', type: 'enum', enum: TrackingMode, default: TrackingMode.QUANTITY })
    trackingMode!: TrackingMode;

    @Column({ name: 'product_type_id', type: 'uuid' })
    productTypeId!: string;

    @Column({ name: 'color_id', type: 'uuid', nullable: true })
    colorId?: string;

    @Column({ name: 'quality_id', type: 'uuid', nullable: true })
    qualityId?: string;

    // ───────── Dónde puede usarse (vistas por encargado) ─────────

    /** Áreas/usos para los que sirve el producto (ventas, reparaciones, etc.). Mínimo uno. */
    @OneToMany(() => ProductUsageLink, (l) => l.product, { cascade: true })
    usages!: ProductUsageLink[];

    // ───────── Inventario ─────────

    /** Alerta de stock bajo. */
    @Column({ name: 'min_stock', type: 'int', default: 0 })
    minStock!: number;

    // ───────── Valores por defecto para nuevos lotes ─────────
    // Solo precargan el ingreso. El lote guarda su propia copia (snapshot).

    /** Garantía por defecto en días (0 = sin garantía). */
    @Column({ name: 'warranty_days', type: 'int', default: 0 })
    warrantyDays!: number;

    /** Precio de venta sugerido por defecto; cada lote define el suyo. */
    @Column({ name: 'base_price', type: 'numeric', precision: 12, scale: 2, default: 0 })
    basePrice!: string;

    /** Por defecto: el producto lleva impuesto. La tarifa la decide facturación. */
    @Column({ name: 'has_tax', default: true })
    hasTax!: boolean;

    /** Por defecto: el precio de venta ya incluye el impuesto. */
    @Column({ name: 'price_includes_tax', default: true })
    priceIncludesTax!: boolean;

    /** Por defecto: se vende bajo factura (si es true, la venta se factura sí o sí). */
    @Column({ name: 'billable_in_sales', default: false })
    billableInSales!: boolean;

    /** Por defecto: facturable al consumirse en una orden de reparación. Exige billableInSales. */
    @Column({ name: 'billable_in_repair_orders', default: false })
    billableInRepairOrders!: boolean;

    @Column({ default: true })
    status!: boolean;

    // ───────── Relaciones ─────────

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @ManyToOne(() => ProductName, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'product_name_id' })
    productName!: ProductName;

    @ManyToOne(() => ProductType, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'product_type_id' })
    productType!: ProductType;

    @ManyToOne(() => Color, { onDelete: 'RESTRICT', nullable: true })
    @JoinColumn({ name: 'color_id' })
    color?: Color;

    @ManyToOne(() => Quality, { onDelete: 'RESTRICT', nullable: true })
    @JoinColumn({ name: 'quality_id' })
    quality?: Quality;

    @OneToMany(() => ProductModel, (pm) => pm.product, { cascade: true })
    compatibleModels!: ProductModel[];

    @OneToMany(() => ProductImage, (img) => img.product)
    images!: ProductImage[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}