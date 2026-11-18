import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Contador por sucursal + tipo (RECIBO / RETORNO) + serie. */
@Entity('receipt_sequences')
@Index('uq_receipt_sequences_scope', ['companyId', 'branchId', 'kind', 'series'], { unique: true })
export class ReceiptSequence {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ type: 'varchar', length: 10 }) kind!: string;
  @Column({ type: 'varchar', length: 6 }) series!: string;

  @Column({ name: 'last_value', type: 'int', default: 0 }) lastValue!: number;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}