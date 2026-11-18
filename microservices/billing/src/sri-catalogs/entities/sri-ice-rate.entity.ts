// sri-ice-rate.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sri_ice_rates')
@Index(['code', 'description'], { unique: true })
export class SriIceRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 4 })
  code: string;            // 3011, 3041... (se repite, por eso no es PK)

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'varchar', length: 5, default: 'SRI' })
  origin: string;          // SRI (local) o SENAE (importación)

  @Column({ type: 'decimal', precision: 7, scale: 2, nullable: true })
  adValoremRate: number | null;   // % (ej. 75.00)

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  specificRate: number | null;    // USD (ej. 10.0000)

  @Column({ type: 'varchar', length: 30, nullable: true })
  specificUnit: string | null;    // 'LITRO_ALCOHOL_PURO', '100G_AZUCAR', 'UNIDAD'...

  @Column({ default: true })
  active: boolean;
}