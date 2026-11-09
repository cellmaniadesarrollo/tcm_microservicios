import {
  Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn,
  Unique, UpdateDateColumn,
} from 'typeorm';

export enum ClaimStatus {
  PENDING_IDENTIFICATION = 'PENDING_IDENTIFICATION',
  CONFIRMED = 'CONFIRMED',
  REWARDED = 'REWARDED',
  REVERSED = 'REVERSED',
  REJECTED = 'REJECTED',
}

export enum ClaimSource {
  LINK = 'LINK',
  QR = 'QR',
  CODE = 'CODE',
  SEARCH = 'SEARCH',
  STAFF = 'STAFF',
}

@Entity('referral_claims')
@Unique('uq_claim_referred', ['referredCustomerId'])
@Check('chk_no_self_referral', '"referrer_customer_id" IS NULL OR "referrer_customer_id" <> "referred_customer_id"')
export class ReferralClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ name: 'referred_customer_id', type: 'varchar', length: 36 })
  referredCustomerId!: string;

  @Index()
  @Column({ name: 'referrer_customer_id', type: 'varchar', length: 36, nullable: true })
  referrerCustomerId!: string | null; // null mientras está pendiente

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.PENDING_IDENTIFICATION })
  status!: ClaimStatus;

  @Column({ type: 'enum', enum: ClaimSource })
  source!: ClaimSource;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}