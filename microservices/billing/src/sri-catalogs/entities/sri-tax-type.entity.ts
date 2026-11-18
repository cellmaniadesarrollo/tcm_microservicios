// sri-tax-type.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_tax_types')
export class SriTaxType {
  @PrimaryColumn({ type: 'varchar', length: 1 })
  code: string;            // 2 = IVA, 3 = ICE, 5 = IRBPNR

  @Column({ type: 'varchar', length: 50 })
  name: string;
}