import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('referral_claim_change_log')
export class ReferralClaimChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'claim_id', type: 'varchar', length: 36 })
  claimId!: string;

  @Column({ name: 'old_referrer_id', type: 'varchar', length: 36, nullable: true })
  oldReferrerId!: string | null;

  @Column({ name: 'new_referrer_id', type: 'varchar', length: 36, nullable: true })
  newReferrerId!: string | null;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}