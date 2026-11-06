import {
    Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
    PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Product } from '../../products/entities/product.entity';

/**
 * Cómo llama un proveedor a uno de nuestros productos (o a un concepto sin stock).
 * Se aprende al guardar ingresos; nadie lo crea a mano.
 *
 * Un código apunta a UN solo destino: un producto o "no es inventario" (transporte, servicio...).
 * Varios códigos pueden apuntar al mismo producto. Si el usuario cambia el destino de un
 * código en un ingreso nuevo, el mapeo se corrige (gana lo último) y el cambio queda en la auditoría.
 *
 * unit_factor: unidades NUESTRAS por cada unidad del proveedor (caja de 10 -> 10).
 * Solo sirve para proponer cantidad y costo en el próximo ingreso; el usuario puede cambiarlos.
 */
@Entity('supplier_product_codes')
@Index('uq_supplier_product_codes', ['companyId', 'supplierId', 'code'], { unique: true })
@Index('idx_supplier_product_codes_product', ['productId'])
@Check('chk_supplier_product_codes_factor', `"unit_factor" > 0`)
// Producto XOR "no es inventario"
@Check(
    'chk_supplier_product_codes_target',
    `("is_non_inventory" = true AND "product_id" IS NULL) OR ("is_non_inventory" = false AND "product_id" IS NOT NULL)`,
)
export class SupplierProductCode {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'supplier_id', type: 'uuid' })
    supplierId!: string;

    /** Código del proveedor, normalizado (trim + mayúsculas). */
    @Column({ length: 100 })
    code!: string;

    /** Última descripción vista en el documento del proveedor. */
    @Column({ length: 300, nullable: true })
    description?: string;

    /** Nulo cuando el código es un concepto sin inventario. */
    @Column({ name: 'product_id', type: 'uuid', nullable: true })
    productId?: string;

    /** true = este código es un concepto sin stock (transporte, servicio...). */
    @Column({ name: 'is_non_inventory', default: false })
    isNonInventory!: boolean;

    @Column({ name: 'unit_factor', type: 'numeric', precision: 12, scale: 4, default: 1 })
    unitFactor!: string;

    @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
    lastUsedAt?: Date;

    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'supplier_id' })
    supplier!: Supplier;

    @ManyToOne(() => Product, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'product_id' })
    product?: Product;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}