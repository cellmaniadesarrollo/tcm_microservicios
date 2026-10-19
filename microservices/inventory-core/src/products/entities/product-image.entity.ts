import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, Index,
} from 'typeorm';
import { Product } from './product.entity';

/** Imágenes de un producto. Guarda la KEY de S3 (no la URL): se firma al leer. */
@Entity('product_images')
@Index('idx_product_images_product_sort', ['productId', 'sortOrder'])
// Máximo una imagen principal por producto
@Index('uq_product_images_primary', ['productId'], {
    unique: true,
    where: '"is_primary" = true',
})
export class ProductImage {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @Column({ name: 'file_key', length: 500 })
    fileKey!: string;

    @Column({ name: 'file_name', length: 255 })
    fileName!: string;

    @Column({ name: 'mime_type', length: 100 })
    mimeType!: string;

    @Column({ name: 'size_bytes', type: 'int' })
    sizeBytes!: number;

    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ name: 'is_primary', default: false })
    isPrimary!: boolean;

    /** Usuario que la subió (réplica de usuarios, sin FK). */
    @Column({ name: 'uploaded_by_id', type: 'uuid' })
    uploadedById!: string;

    @ManyToOne(() => Product, (p) => p.images, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'product_id' })
    product!: Product;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}