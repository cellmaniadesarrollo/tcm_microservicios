import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Contador por emisor + tipo de comprobante + serie. */
@Entity('sri_sequences')
@Index('uq_sri_sequences_scope', ['issuerId', 'documentTypeCode', 'series'], { unique: true })
export class SriSequence {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @Column({ name: 'issuer_id', type: 'uuid' }) issuerId!: string;
  @Column({ name: 'document_type_code', type: 'varchar', length: 2 }) documentTypeCode!: string;
  @Column({ type: 'varchar', length: 6 }) series!: string;

  /** Último secuencial emitido. */
  @Column({ name: 'last_value', type: 'int', default: 0 }) lastValue!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}