import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DiscountType } from './document-discount.entity';

export type DiscountValueKind = 'PERCENT' | 'AMOUNT';

@Entity('discounts')
@Index('idx_discounts_company_active', ['companyId', 'isActive'])
@Index('uq_discounts_default_name', ['companyId', 'name'], {
  unique: true,
  where: '"is_default" = true',
})
export class Discount {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;

  @Column({ type: 'varchar', length: 80 }) name!: string;
  /** NORMAL o CREDITO. */
  @Column({ type: 'varchar', length: 10 }) type!: DiscountType;
  /** PERCENT (ej. 10 = 10%) o AMOUNT (dinero fijo). */
  @Column({ name: 'value_kind', type: 'varchar', length: 10 }) valueKind!: DiscountValueKind;
  @Column({ type: 'decimal', precision: 14, scale: 2 }) value!: string;

  /** Los 5 fijos: no vencen y no se desactivan solos. */
  @Column({ name: 'is_default', type: 'boolean', default: false }) isDefault!: boolean;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  /** createdAt + 24 h para los no default; null para los default. */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;

  @Column({ name: 'deactivated_by', type: 'uuid', nullable: true }) deactivatedBy!: string | null;
  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true }) deactivatedAt!: Date | null;
}