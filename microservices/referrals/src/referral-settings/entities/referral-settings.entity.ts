import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('referral_settings')
export class ReferralSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percent!: string; // 10.00 = 10 %

  // Costos a descontar de la utilidad: { parts: true, shipping: true, gateway: true, commission: true, warranty: false }
  @Column({ name: 'cost_components', type: 'jsonb' })
  costComponents!: Record<string, boolean>;

  @Column({ name: 'valid_from', type: 'timestamp' })
  validFrom!: Date;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}