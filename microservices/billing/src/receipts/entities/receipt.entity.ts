import {
  Column, CreateDateColumn, Entity, Index, OneToMany,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { ReceiptLine } from './receipt-line.entity';

export type ReceiptKind = 'RECIBO' | 'RETORNO';

@Entity('receipts')
@Index('uq_receipts_number', ['companyId', 'branchId', 'kind', 'series', 'sequence'], { unique: true })
@Index('uq_receipts_request', ['companyId', 'clientRequestId'], { unique: true })
export class Receipt {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'order_id', type: 'uuid', nullable: true }) orderId!: string | null;

  /** RECIBO o RETORNO. */
  @Column({ type: 'varchar', length: 10 }) kind!: ReceiptKind;
  /** Solo para RETORNO: el recibo que se devuelve. */
  @Column({ name: 'related_receipt_id', type: 'uuid', nullable: true }) relatedReceiptId!: string | null;

  @Column({ type: 'varchar', length: 6 }) series!: string;     // 001001
  @Column({ type: 'varchar', length: 9 }) sequence!: string;   // 000000001
  @Column({ name: 'issue_date', type: 'date' }) issueDate!: string;
  @Column({ name: 'status_code', type: 'varchar', length: 12, default: 'EMITIDO' }) statusCode!: string; // EMITIDO, ANULADO

  // Cliente (snapshot)
  @Column({ name: 'buyer_id_number', type: 'varchar', length: 20, nullable: true }) buyerIdNumber!: string | null;
  @Column({ name: 'buyer_name', type: 'varchar', length: 300 }) buyerName!: string;

  // Totales
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) subtotal!: string;
  @Column({ name: 'total_discount', type: 'decimal', precision: 14, scale: 2, default: 0 }) totalDiscount!: string;
  @Column({ name: 'vat_value', type: 'decimal', precision: 14, scale: 2, default: 0 }) vatValue!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) total!: string;

  @Column({ name: 'client_request_id', type: 'varchar', length: 64 }) clientRequestId!: string;

  @OneToMany(() => ReceiptLine, (l) => l.receipt, { cascade: true })
  lines!: ReceiptLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}