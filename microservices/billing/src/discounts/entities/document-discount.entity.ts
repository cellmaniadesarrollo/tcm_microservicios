import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DiscountType = 'NORMAL' | 'CREDITO';
export type DiscountDocType = 'FACTURA' | 'RECIBO' | 'RETORNO' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

/** Un registro por cada descuento aplicado a una línea de un documento. */
@Entity('document_discounts')
@Index('idx_document_discounts_doc', ['companyId', 'documentType', 'documentId'])
@Index('idx_document_discounts_report', ['companyId', 'createdAt'])
export class DocumentDiscount {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;

  @Column({ name: 'document_type', type: 'varchar', length: 15 }) documentType!: DiscountDocType;
  @Column({ name: 'document_id', type: 'uuid' }) documentId!: string;
  @Column({ name: 'line_id', type: 'uuid', nullable: true }) lineId!: string | null;

  /** NORMAL o CREDITO. */
  @Column({ type: 'varchar', length: 10 }) type!: DiscountType;

  /** Valor descontado en dinero (calculado por el servidor). */
  @Column({ type: 'decimal', precision: 14, scale: 2 }) amount!: string;

  /** Base sobre la que se aplicó (cantidad × precio), para auditar el porcentaje. */
  @Column({ name: 'base_amount', type: 'decimal', precision: 14, scale: 2 }) baseAmount!: string;

  @Column({ type: 'varchar', length: 200, nullable: true }) reason!: string | null;

  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  @Column({ name: 'deactivated_by', type: 'uuid', nullable: true }) deactivatedBy!: string | null;
  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true }) deactivatedAt!: Date | null;
  @Column({ name: 'deactivation_reason', type: 'varchar', length: 200, nullable: true })
  deactivationReason!: string | null;
  @Column({ name: 'discount_id', type: 'uuid', nullable: true }) discountId!: string | null;
}