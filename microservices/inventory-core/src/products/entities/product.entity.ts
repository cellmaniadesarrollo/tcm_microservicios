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
import { TrackingMode, BillingMode } from '../enums/product.enums';
import { ProductModel } from './product-model.entity';
import { ProductImage } from './product-image.entity';

/**
 * Producto (SKU). No guarda existencias ni costos: eso vive en lotes, saldos y unidades.
 *
 * code -> correlativo numérico por empresa. Inmutable.
 * sku  -> {KIND}-{TIPO}-{MARCA}-{code con ceros}, ej: REP-BAT-SAM-000111. Inmutable.
 *
 * Las banderas is_* indican PARA QUÉ puede usarse el producto (capacidad del catálogo).
 * Dónde está una pieza y en qué estado vive en lote, saldo y unidad.
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
@Index('idx_products_company_sellable', ['companyId', 'isSellable'])
@Index('idx_products_company_repair', ['companyId', 'isRepairPart'])
@Index('idx_products_company_custom', ['companyId', 'isCustomizable'])
// Un equipo completo siempre es serializado
@Check('chk_products_device_serial', `"kind" <> 'DEVICE' OR "tracking_mode" = 'SERIAL'`)
// Todo producto debe servir al menos para un área
@Check('chk_products_has_usage', `"is_sellable" OR "is_repair_part" OR "is_customizable"`)
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

    /** Se puede vender directo (vista de ventas). */
    @Column({ name: 'is_sellable', default: true })
    isSellable!: boolean;

    /** Se consume como pieza en una orden de reparación (vista de repuestos). */
    @Column({ name: 'is_repair_part', default: false })
    isRepairPart!: boolean;

    /** Se puede personalizar (vista de personalizaciones). */
    @Column({ name: 'is_customizable', default: false })
    isCustomizable!: boolean;

    // ───────── Inventario y comercial ─────────

    /** Alerta de stock bajo. */
    @Column({ name: 'min_stock', type: 'int', default: 0 })
    minStock!: number;

    /** Garantía en días (0 = sin garantía). */
    @Column({ name: 'warranty_days', type: 'int', default: 0 })
    warrantyDays!: number;

    /** Precio sugerido por defecto; cada lote puede definir el suyo. */
    @Column({ name: 'base_price', type: 'numeric', precision: 12, scale: 2, default: 0 })
    basePrice!: string;

    @Column({ name: 'has_tax', default: true })
    hasTax!: boolean;

    @Column({ name: 'billing_mode', type: 'enum', enum: BillingMode, default: BillingMode.NO })
    billingMode!: BillingMode;

    /** Facturable específicamente al consumirse en una orden de reparación. */
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