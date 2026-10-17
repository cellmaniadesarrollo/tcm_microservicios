import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Product } from './product.entity';
import { Model } from '../../devices-replica/entities/model.entity';

/** Compatibilidad N:M producto <-> modelo. Un equipo completo tiene exactamente un modelo (se valida en el servicio). */
@Entity('product_models')
@Index('idx_product_models_model', ['modelId'])
export class ProductModel {
    @PrimaryColumn({ name: 'product_id', type: 'uuid' })
    productId!: string;

    @PrimaryColumn({ name: 'model_id', type: 'int' })
    modelId!: number; // FK -> models.models_id

    @ManyToOne(() => Product, (p) => p.compatibleModels, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'product_id' })
    product!: Product;

    @ManyToOne(() => Model, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'model_id', referencedColumnName: 'models_id' })
    model!: Model;
}