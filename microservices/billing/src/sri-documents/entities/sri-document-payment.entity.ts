import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SriDocument } from './sri-document.entity';

@Entity('sri_document_payments')
export class SriDocumentPayment {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'document_id', type: 'uuid' }) documentId!: string;

  @ManyToOne(() => SriDocument, (d) => d.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: SriDocument;

  /** Tabla 24 del SRI: 01, 15, 16, 17, 18, 19, 20, 21. */
  @Column({ name: 'method_code', type: 'varchar', length: 2 }) methodCode!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 }) amount!: string;
  @Column({ type: 'int', nullable: true }) term!: number | null;
  @Column({ name: 'time_unit', type: 'varchar', length: 10, nullable: true }) timeUnit!: string | null;
}