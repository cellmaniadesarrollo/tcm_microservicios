import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('referral_link_visits')
export class ReferralLinkVisit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  token!: string; // public_token del recomendador

  @Index()
  @Column({ name: 'visitor_id', type: 'varchar', length: 64 })
  visitorId!: string; // cookie propia, no IP

  @Column({ type: 'jsonb', nullable: true })
  utm!: Record<string, string> | null;

  @Column({ name: 'claimed_by_customer_id', type: 'varchar', length: 36, nullable: true })
  claimedByCustomerId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}