import {
  Column, CreateDateColumn, Entity, Index, OneToMany,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { SriDocumentLine } from './sri-document-line.entity';
import { SriDocumentPayment } from './sri-document-payment.entity';

@Entity('sri_documents')
@Index('uq_sri_documents_number', ['companyId', 'issuerId', 'documentTypeCode', 'series', 'sequence'], { unique: true })
@Index('uq_sri_documents_access_key', ['accessKey'], { unique: true })
@Index('idx_sri_documents_company_status', ['companyId', 'statusCode'])
@Index('uq_sri_documents_request', ['companyId', 'clientRequestId'], { unique: true })
@Index('idx_sri_documents_modified', ['modifiedDocumentId']) // NUEVO
export class SriDocument {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @Column({ name: 'issuer_id', type: 'uuid' }) issuerId!: string;
  @Column({ name: 'signature_id', type: 'uuid', nullable: true }) signatureId!: string | null;
  @Column({ name: 'branch_id', type: 'uuid', nullable: true }) branchId!: string | null;
  @Column({ name: 'order_id', type: 'uuid', nullable: true }) orderId!: string | null;

  // --- Catálogos SRI ---
  @Column({ name: 'document_type_code', type: 'varchar', length: 2 }) documentTypeCode!: string;
  @Column({ name: 'environment_code', type: 'varchar', length: 1 }) environmentCode!: string;
  @Column({ name: 'emission_type_code', type: 'varchar', length: 1, default: '1' }) emissionTypeCode!: string;
  /** BORRADOR, FIRMADO, RECIBIDO (internos) + PPR, AUT, NAT (SRI). */
  @Column({ name: 'status_code', type: 'varchar', length: 12, default: 'BORRADOR' }) statusCode!: string;

  // --- Numeración ---
  @Column({ type: 'varchar', length: 6 }) series!: string;
  @Column({ type: 'varchar', length: 9 }) sequence!: string;
  @Column({ name: 'access_key', type: 'char', length: 49, nullable: true }) accessKey!: string | null;
  @Column({ name: 'issue_date', type: 'date' }) issueDate!: string;

  // --- Documento modificado (NC / ND) --- NUEVO
  /** En una NC/ND: factura que se modifica. */
  @Column({ name: 'modified_document_id', type: 'uuid', nullable: true }) modifiedDocumentId!: string | null;
  /** En una NC: motivo (va en <motivo>). */
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null;

  // --- Comprador (snapshot) ---
  @Column({ name: 'buyer_id_type_code', type: 'varchar', length: 2 }) buyerIdTypeCode!: string;
  @Column({ name: 'buyer_id_number', type: 'varchar', length: 20 }) buyerIdNumber!: string;
  @Column({ name: 'buyer_name', type: 'varchar', length: 300 }) buyerName!: string;
  @Column({ name: 'buyer_address', type: 'varchar', length: 300, nullable: true }) buyerAddress!: string | null;
  @Column({ name: 'buyer_email', type: 'varchar', length: 255, nullable: true }) buyerEmail!: string | null;

  // --- Totales ---
  @Column({ name: 'subtotal_vat', type: 'decimal', precision: 14, scale: 2, default: 0 }) subtotalVat!: string;
  @Column({ name: 'subtotal_zero', type: 'decimal', precision: 14, scale: 2, default: 0 }) subtotalZero!: string;
  @Column({ name: 'subtotal_not_object', type: 'decimal', precision: 14, scale: 2, default: 0 }) subtotalNotObject!: string;
  @Column({ name: 'subtotal_exempt', type: 'decimal', precision: 14, scale: 2, default: 0 }) subtotalExempt!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) subtotal!: string;
  @Column({ name: 'total_discount', type: 'decimal', precision: 14, scale: 2, default: 0 }) totalDiscount!: string;
  @Column({ name: 'ice_value', type: 'decimal', precision: 14, scale: 2, default: 0 }) iceValue!: string;
  @Column({ name: 'vat_value', type: 'decimal', precision: 14, scale: 2, default: 0 }) vatValue!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) tip!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) total!: string;

  // --- Resultado SRI ---
  @Column({ name: 'xml_unsigned', type: 'text', nullable: true }) xmlUnsigned!: string | null;
  @Column({ name: 'xml_signed', type: 'text', nullable: true }) xmlSigned!: string | null;
  @Column({ name: 'xml_authorized', type: 'text', nullable: true }) xmlAuthorized!: string | null;
  /** Keys de S3 (nunca URLs). */
  @Column({ name: 'xml_unsigned_key', type: 'varchar', length: 500, nullable: true }) xmlUnsignedKey!: string | null;
  @Column({ name: 'xml_signed_key', type: 'varchar', length: 500, nullable: true }) xmlSignedKey!: string | null;
  @Column({ name: 'xml_authorized_key', type: 'varchar', length: 500, nullable: true }) xmlAuthorizedKey!: string | null;
  @Column({ name: 'authorized_at', type: 'timestamptz', nullable: true }) authorizedAt!: Date | null;
  @Column({ name: 'authorization_number', type: 'varchar', length: 49, nullable: true }) authorizationNumber!: string | null;

  // --- Error / reintentos ---
  @Column({ name: 'last_error_code', type: 'varchar', length: 4, nullable: true }) lastErrorCode!: string | null;
  @Column({ name: 'last_error_message', type: 'text', nullable: true }) lastErrorMessage!: string | null;
  @Column({ type: 'int', default: 0 }) attempts!: number;
  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true }) nextRetryAt!: Date | null;

  // --- Idempotencia ---
  @Column({ name: 'client_request_id', type: 'varchar', length: 64 }) clientRequestId!: string;

  @OneToMany(() => SriDocumentLine, (l) => l.document, { cascade: true })
  lines!: SriDocumentLine[];

  @OneToMany(() => SriDocumentPayment, (p) => p.document, { cascade: true })
  payments!: SriDocumentPayment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;

  /** NONE | ISSUED (descontado) | RETURNED (devuelto) */
  @Column({ name: 'stock_state', type: 'varchar', length: 10, default: 'NONE' }) stockState!: string;

  @Column({ name: 'sri_messages', type: 'jsonb', nullable: true }) sriMessages!: unknown[] | null;
}