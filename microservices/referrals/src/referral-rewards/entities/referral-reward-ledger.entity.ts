import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum LedgerType {
  CREDIT = 'CREDIT',
  REVERSAL = 'REVERSAL',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity('referral_reward_ledger')
export class ReferralRewardLedger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'reward_id', type: 'varchar', length: 36 })
  rewardId!: string;

  @Index()
  @Column({ name: 'referrer_customer_id', type: 'varchar', length: 36 })
  referrerCustomerId!: string;

  @Column({ type: 'enum', enum: LedgerType })
  type!: LedgerType;

  // positivo suma, negativo resta
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}