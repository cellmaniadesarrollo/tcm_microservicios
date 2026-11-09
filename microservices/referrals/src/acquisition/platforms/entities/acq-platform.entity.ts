import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('acq_platforms')
export class AcqPlatform {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string; // Facebook, Instagram, YouTube, TikTok

  @Column({ default: true })
  active!: boolean;
}