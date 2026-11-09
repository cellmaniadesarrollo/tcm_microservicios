import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('company_sequences')
export class CompanySequence {
  @PrimaryColumn({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  key!: string; // 'referral_code'

  @Column({ name: 'last_value', type: 'int', default: 0 })
  lastValue!: number;
}