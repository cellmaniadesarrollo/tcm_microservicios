import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('acq_campaigns')
export class AcqCampaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ name: 'channel_id', type: 'varchar', length: 36, nullable: true })
  channelId!: string | null;

  @Column({ name: 'platform_id', type: 'varchar', length: 36, nullable: true })
  platformId!: string | null;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  token!: string; // para enlace/QR propio de la campaña

  // Inversión, para el reporte de rentabilidad
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  investment!: string;

  @Column({ name: 'starts_at', type: 'date', nullable: true })
  startsAt!: Date | null;

  @Column({ name: 'ends_at', type: 'date', nullable: true })
  endsAt!: Date | null;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}