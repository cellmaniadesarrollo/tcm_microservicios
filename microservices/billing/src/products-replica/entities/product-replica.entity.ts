import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Réplica de productos de inventory-core. Sin FK: se puede truncar para forzar reconciliación. */
@Entity('products_replica')
@Index('idx_products_replica_company_sku', ['companyId', 'sku'])
@Index('idx_products_replica_company_status', ['companyId', 'status'])
@Index('idx_products_replica_updated', ['updatedAt'])
export class ProductReplica {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ type: 'int' })
    code!: number;

    @Column({ length: 100 })
    sku!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    upc!: string | null;

    @Column({ length: 255 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ length: 20 })
    kind!: string;

    @Column({ name: 'tracking_mode', length: 20 })
    trackingMode!: string;

    @Column({ name: 'product_type_id', type: 'uuid' })
    productTypeId!: string;

    @Column({ name: 'product_type_code', length: 10 })
    productTypeCode!: string;

    @Column({ name: 'product_type_name', length: 100 })
    productTypeName!: string;

    @Column({ name: 'color_id', type: 'uuid', nullable: true })
    colorId!: string | null;

    @Column({ name: 'color_name', type: 'varchar', length: 100, nullable: true })
    colorName!: string | null;

    @Column({ name: 'quality_id', type: 'uuid', nullable: true })
    qualityId!: string | null;

    @Column({ name: 'quality_name', type: 'varchar', length: 100, nullable: true })
    qualityName!: string | null;

    @Column({ name: 'model_ids', type: 'int', array: true, default: () => "'{}'" })
    modelIds!: number[];

    @Column({ default: true })
    status!: boolean;

    /** Informativo (precio base, IVA, banderas). La decisión de usarlos queda para después. */
    @Column({ type: 'jsonb' })
    defaults!: Record<string, unknown>;

    @Column({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    /** Fecha de actualización en inventory (guard de orden). No es la fecha local. */
    @Column({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;

    @Column({ name: 'synced_at', type: 'timestamptz', default: () => 'now()' })
    syncedAt!: Date;
}