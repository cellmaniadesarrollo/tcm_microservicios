import { Entity, PrimaryColumn, Column, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Model } from './model.entity';

@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn({ type: 'int' })
  brands_id!: number;

  @Column({ length: 50 })
  brands_find_id: string;

  @Column({ length: 255 })
  brands_name: string;

  @Column()
  brands_devices_count: number;

  @Column()
  brands_laptops_count: number;

  @OneToMany(() => Model, (model) => model.brand)
  models: Model[];
}
