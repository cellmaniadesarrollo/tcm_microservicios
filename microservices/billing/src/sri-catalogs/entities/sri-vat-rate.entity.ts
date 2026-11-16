// sri-vat-rate.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_vat_rates')
export class SriVatRate {
  @PrimaryColumn({ type: 'varchar', length: 2 })
  code: string;            // codigoPorcentaje en el XML: 0, 2, 3, 4, 5, 6, 7, 8, 10

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;      // 0 para "No objeto" y "Exento"

  @Column({ default: false })
  taxable: boolean;        // true solo si genera IVA (12%, 14%, 15%, 5%, 13%, 8%)

  @Column({ default: true })
  active: boolean;         // desactiva las tarifas que ya no se usan
}