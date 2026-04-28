import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Brand } from './brand.entity';

@Entity('models')
export class Model {
  @PrimaryColumn()
  models_id: number;

  @Column({ length: 100 })
  models_find_id: string;

  @Column({ length: 255 })
  models_name: string;

  @Column()
  models_brands_id: number; // ← FK hacia brands.brands_id

  @Column({ length: 500, nullable: true })
  models_img_url: string;

  @Column({ type: 'text', nullable: true })
  models_description: string;

  @ManyToOne(() => Brand, (brand) => brand.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'models_brands_id', referencedColumnName: 'brands_id' })
  brand: Brand;
}
 