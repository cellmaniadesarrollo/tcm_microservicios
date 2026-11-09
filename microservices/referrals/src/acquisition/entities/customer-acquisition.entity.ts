import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum HowArrived {
  SOCIAL = 'SOCIAL',
  REFERRED = 'REFERRED',
  EXISTING_CLIENT = 'EXISTING_CLIENT',
  WALK_IN = 'WALK_IN',
  OTHER = 'OTHER',
}

@Entity('customer_acquisitions')          // ← tabla nueva
@Unique('uq_acq_customer', ['customerId', 'companyId'])  // ← único por cliente+empresa
export class CustomerAcquisition {        // ← clase renombrada
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  // orderId eliminado

  @Index()
  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  customerId!: string;

  @Column({ name: 'how_arrived', type: 'enum', enum: HowArrived })
  howArrived!: HowArrived;

  @Column({ name: 'platform_id', type: 'varchar', length: 36, nullable: true })
  platformId!: string | null;

  @Column({ name: 'channel_id', type: 'varchar', length: 36, nullable: true })
  channelId!: string | null;

  @Column({ name: 'campaign_id', type: 'varchar', length: 36, nullable: true })
  campaignId!: string | null;

  @Column({ name: 'publication_id', type: 'varchar', length: 36, nullable: true })
  publicationId!: string | null;

  @Column({ name: 'not_remembered', default: false })
  notRemembered!: boolean;

  @Column({ name: 'other_text', type: 'varchar', length: 255, nullable: true })
  otherText!: string | null;

  @Column({ name: 'registered_by', type: 'varchar', length: 36 })
  registeredBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}