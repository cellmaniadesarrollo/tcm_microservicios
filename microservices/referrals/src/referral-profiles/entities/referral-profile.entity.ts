import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique,
} from 'typeorm';

export type ReferralProfileSource = 'ORDER' | 'PURCHASE' | 'MANUAL';

@Entity('referral_profiles')
@Unique('uq_profile_customer', ['customerId'])
@Unique('uq_profile_company_code', ['companyId', 'code'])
@Index('idx_profile_token', ['publicToken'], { unique: true })
export class ReferralProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  customerId!: string;

  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ type: 'varchar', length: 10 })
  code!: string;

  @Column({ name: 'public_token', type: 'varchar', length: 32 })
  publicToken!: string;

  /** Qué generó el código: orden de reparación, compra o creación manual */
  @Column({ name: 'source_type', type: 'varchar', length: 20, default: 'ORDER' })
  sourceType!: ReferralProfileSource;

  /** Id de la orden o compra que lo originó (null si es manual) */
  @Column({ name: 'source_id', type: 'varchar', length: 36, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'welcome_sent_at', type: 'timestamp', nullable: true })
  welcomeSentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}