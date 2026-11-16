// sri-withholding-type.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_withholding_types')
export class SriWithholdingType {
  @PrimaryColumn({ type: 'varchar', length: 1 })
  code: string;            // 1 = Renta, 2 = IVA, 6 = ISD

  @Column({ type: 'varchar', length: 50 })
  name: string;
}