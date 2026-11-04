import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';

export enum RewardStatus {
  PENDING = 'PENDING',
  CREDITED = 'CREDITED',
  REVERSED = 'REVERSED',
}

@Entity('referral_rewards')
@Unique('uq_reward_claim', ['claimId']) // una sola recompensa por referido
export class ReferralReward {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'claim_id', type: 'varchar', length: 36 })
  claimId!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Index()
  @Column({ name: 'referrer_customer_id', type: 'varchar', length: 36 })
  referrerCustomerId!: string;

  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  orderId!: string;

  @Column({ name: 'net_profit', type: 'decimal', precision: 12, scale: 2 })
  netProfit!: string;

  @Column({ name: 'percent_snapshot', type: 'decimal', precision: 5, scale: 2 })
  percentSnapshot!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'enum', enum: RewardStatus, default: RewardStatus.PENDING })
  status!: RewardStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}