import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Product } from "./product.entity";
import { ProductUsage } from "../../product-catalogs/entities/product-usage.entity";

@Entity('product_usage_links')
@Index('uq_product_usage_links', ['productId', 'usageId'], { unique: true })
@Index('idx_product_usage_links_usage', ['usageId', 'productId'])
export class ProductUsageLink {
    @PrimaryColumn({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @PrimaryColumn({ name: 'usage_id', type: 'uuid' })
    usageId!: string;

    @ManyToOne(() => Product, (p) => p.usages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'product_id' })
    product!: Product;

    @ManyToOne(() => ProductUsage, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'usage_id' })
    usage!: ProductUsage;
}