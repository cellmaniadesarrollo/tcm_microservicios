import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Receipt } from './receipt.entity';
import { PaymentMethod } from '../enums/receipt.enums';

/**
 * Pago (cuota) de un ingreso. Nunca se borra: se anula con motivo.
 * La suma de los pagos NO anulados es receipts.paid_total.
 * El comprobante (imagen o PDF) se guarda en S3; aquí solo la key.
 */
@Entity('receipt_payments')
@Index('idx_receipt_payments_receipt', ['receiptId', 'createdAt'])
@Index('uq_receipt_payments_client_request', ['companyId', 'clientRequestId'], { unique: true })
@Check('chk_receipt_payments_amount', `"amount" > 0`)
@Check('chk_receipt_payments_voided', `("voided_at" IS NULL) = ("voided_by_id" IS NULL)`)
export class ReceiptPayment {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'receipt_id', type: 'uuid' })
    receiptId!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Idempotencia: UUID generado por el front al abrir el formulario de pago. */
    @Column({ name: 'client_request_id', type: 'uuid', update: false })
    clientRequestId!: string;

    @Column({ type: 'numeric', precision: 14, scale: 2, update: false })
    amount!: string;

    /** Fecha en que se hizo el pago (no la de registro). */
    @Column({ name: 'paid_at', type: 'date' })
    paidAt!: string;

    @Column({ type: 'enum', enum: PaymentMethod })
    method!: PaymentMethod;

    /** N° de transferencia, cheque, voucher... */
    @Column({ length: 100, nullable: true })
    reference?: string;

    @Column({ length: 500, nullable: true })
    note?: string;

    // ───────── Comprobante ─────────

    @Column({ name: 'proof_key', length: 500, nullable: true })
    proofKey?: string;

    @Column({ name: 'proof_name', length: 255, nullable: true })
    proofName?: string;

    @Column({ name: 'proof_mime', length: 100, nullable: true })
    proofMime?: string;

    @Column({ name: 'proof_size', type: 'int', nullable: true })
    proofSize?: number;

    // ───────── Trazabilidad (usuarios replicados, sin FK) ─────────

    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
    voidedAt?: Date;

    @Column({ name: 'voided_by_id', type: 'uuid', nullable: true })
    voidedById?: string;

    @Column({ name: 'void_reason', length: 500, nullable: true })
    voidReason?: string;

    @ManyToOne(() => Receipt, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'receipt_id' })
    receipt!: Receipt;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}