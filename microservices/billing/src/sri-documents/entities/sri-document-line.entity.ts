import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SriDocument } from './sri-document.entity';

@Entity('sri_document_lines')
export class SriDocumentLine {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'document_id', type: 'uuid' }) documentId!: string;

  @ManyToOne(() => SriDocument, (d) => d.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: SriDocument;

  @Column({ type: 'int' }) position!: number;
  @Column({ name: 'main_code', type: 'varchar', length: 25 }) mainCode!: string;
  @Column({ type: 'varchar', length: 300 }) description!: string;

  @Column({ type: 'decimal', precision: 14, scale: 6 }) quantity!: string;
  @Column({ name: 'unit_price', type: 'decimal', precision: 14, scale: 6 }) unitPrice!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) discount!: string;
  @Column({ name: 'line_total', type: 'decimal', precision: 14, scale: 2 }) lineTotal!: string;

  @Column({ name: 'tax_type_code', type: 'varchar', length: 1, default: '2' }) taxTypeCode!: string;
  @Column({ name: 'vat_rate_code', type: 'varchar', length: 2 }) vatRateCode!: string;
  @Column({ name: 'vat_percentage', type: 'decimal', precision: 5, scale: 2 }) vatPercentage!: string;
  @Column({ name: 'vat_base', type: 'decimal', precision: 14, scale: 2 }) vatBase!: string;
  @Column({ name: 'vat_amount', type: 'decimal', precision: 14, scale: 2 }) vatAmount!: string;
}