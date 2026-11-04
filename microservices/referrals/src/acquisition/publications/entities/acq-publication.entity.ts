import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('acq_publications')
export class AcqPublication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ name: 'campaign_id', type: 'varchar', length: 36, nullable: true })
  campaignId!: string | null;

  @Column({ name: 'channel_id', type: 'varchar', length: 36, nullable: true })
  channelId!: string | null;

  @Column({ name: 'platform_id', type: 'varchar', length: 36, nullable: true })
  platformId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url!: string | null;

  @Column({ default: true })
  active!: boolean;
}