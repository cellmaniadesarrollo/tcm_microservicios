import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Réplica de lotes de inventory-core. Sin FK, sin stock. Se puede truncar y el bulk la reconstruye. */
@Entity('lots_replica')
@Index('idx_lots_replica_company_product', ['companyId', 'productId'])
@Index('uq_lots_replica_company_code', ['companyId', 'code'], { unique: true })
@Index('idx_lots_replica_created', ['createdAt'])
export class LotReplica {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ type: 'int' })
    code!: number;

    @Column({ name: 'origin_type', length: 20 })
    originType!: string;

    @Column({ name: 'quantity_received', type: 'int' })
    quantityReceived!: number;

    @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2 })
    salePrice!: string;

    @Column({ name: 'warranty_days', type: 'int' })
    warrantyDays!: number;

    @Column({ name: 'has_tax' })
    hasTax!: boolean;

    @Column({ name: 'price_includes_tax' })
    priceIncludesTax!: boolean;

    @Column({ name: 'billable_in_sales' })
    billableInSales!: boolean;

    @Column({ name: 'billable_in_repair_orders' })
    billableInRepairOrders!: boolean;

    @Column({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @Column({ name: 'synced_at', type: 'timestamptz', default: () => 'now()' })
    syncedAt!: Date;
}