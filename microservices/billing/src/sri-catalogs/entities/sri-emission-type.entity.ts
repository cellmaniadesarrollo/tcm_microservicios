// entities/sri-emission-type.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_emission_types')
export class SriEmissionType {
  @PrimaryColumn({ type: 'varchar', length: 1 })
  code: string;            // 1

  @Column({ type: 'varchar', length: 50 })
  name: string;
}