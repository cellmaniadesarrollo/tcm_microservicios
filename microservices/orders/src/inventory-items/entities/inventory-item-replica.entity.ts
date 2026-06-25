// microservices/orders/src/inventory-items/entities/inventory-item-replica.entity.ts
import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('inventory_items_replica')
export class InventoryItemReplica {

    @PrimaryColumn()
    id!: string; // _id de inventoryflows (ObjectId como string)

    @Column()
    sku!: string;

    @Column({ nullable: true })
    upc?: string;

    @Column({ nullable: true })
    name_nameitems?: string;

    @Column({ nullable: true })
    name_model?: string;

    @Column({ nullable: true })
    name_color?: string;

    @Column({ nullable: true })
    name_quality?: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    item_price?: number | null;;

    @Column({ default: true })
    is_active!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}