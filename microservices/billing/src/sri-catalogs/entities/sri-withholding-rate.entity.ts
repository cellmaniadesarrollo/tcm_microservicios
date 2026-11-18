// sri-withholding-rate.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sri_withholding_rates')
@Index(['withholdingTypeCode', 'code', 'validFrom'], { unique: true })
export class SriWithholdingRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 1 })
  withholdingTypeCode: string;    // 1, 2, 6

  @Column({ type: 'varchar', length: 6 })
  code: string;                   // el 1 existe en Renta y en IVA; 4580 se repite por vigencia

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;

  @Column({ type: 'date', default: '1900-01-01' })
  validFrom: string;              // fecha fija en vez de null, para que el índice único funcione

  @Column({ type: 'date', nullable: true })
  validTo: string | null;         // null = vigente
}