import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Receipt } from './receipt.entity';

@Entity('receipt_lines')
export class ReceiptLine {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'receipt_id', type: 'uuid' }) receiptId!: string;
  @ManyToOne(() => Receipt, (r) => r.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_id' })
  receipt!: Receipt;

  @Column({ type: 'int' }) position!: number;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId!: string | null;
  @Column({ name: 'lot_id', type: 'uuid', nullable: true }) lotId!: string | null;
  @Column({ name: 'unit_id', type: 'uuid', nullable: true }) unitId!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) batch!: string | null;
  @Column({ name: 'main_code', type: 'varchar', length: 25 }) mainCode!: string;
  @Column({ type: 'varchar', length: 300 }) description!: string;
  @Column({ type: 'decimal', precision: 14, scale: 6 }) quantity!: string;
  @Column({ name: 'unit_price', type: 'decimal', precision: 14, scale: 6 }) unitPrice!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) discount!: string;
  @Column({ name: 'line_total', type: 'decimal', precision: 14, scale: 2 }) lineTotal!: string;
  @Column({ name: 'vat_amount', type: 'decimal', precision: 14, scale: 2, default: 0 }) vatAmount!: string;
}