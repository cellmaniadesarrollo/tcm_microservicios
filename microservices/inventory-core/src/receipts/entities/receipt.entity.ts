import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Index, Check,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { ReceiptStatus, ReceiptSource, PaymentStatus } from '../enums/receipt.enums';
import { ReceiptLine } from './receipt-line.entity';
import { ReceiptDocumentType } from '../../catalogs/entities/receipt-document-type.entity';

/**
 * Ingreso de mercadería (cabecera). Documento que respalda la entrada de productos.
 *
 * REGISTERED -> al guardar ya se crearon lotes, saldos, unidades y movimientos (módulo stock).
 * VERIFIED   -> alguien revisó el ingreso contra el documento. No cambia el stock.
 * VOIDED     -> anulado con movimientos contrarios; nunca se borra.
 *
 * branch_id: siempre la sucursal principal; se guarda para que las transferencias futuras
 * no obliguen a migrar nada.
 *
 * Los totales los calcula el servidor (el front solo los muestra) y son informativos.
 * Los impuestos de venta NO viven aquí: los hace facturación.
 *
 * client_request_id: UUID que genera el front por formulario. Hace el guardado idempotente:
 * reenviar la misma solicitud devuelve el mismo ingreso en vez de duplicar el stock.
 * request_hash: huella del contenido, para detectar el mismo id con datos distintos.
 */
@Entity('receipts')
@Index('uq_receipts_company_code', ['companyId', 'code'], { unique: true })
@Index('uq_receipts_company_client_request', ['companyId', 'clientRequestId'], { unique: true })
// Mismo número de documento del mismo proveedor y tipo: una sola vez (los anulados no cuentan)
@Index('uq_receipts_supplier_document', ['companyId', 'supplierId', 'documentTypeId', 'documentNumber'], {
    unique: true,
    where: `"document_number" IS NOT NULL AND "status" <> 'VOIDED'`,
})
@Index('uq_receipts_company_access_key', ['companyId', 'accessKey'], {
    unique: true,
    where: `"access_key" IS NOT NULL AND "status" <> 'VOIDED'`,
})
@Index('idx_receipts_company_status', ['companyId', 'status'])
@Index('idx_receipts_company_supplier', ['companyId', 'supplierId'])
@Index('idx_receipts_company_issue_date', ['companyId', 'issueDate'])
@Check('chk_receipts_totals_nonneg', `"subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "total" >= 0`)
@Check('chk_receipts_verified_at', `"status" <> 'VERIFIED' OR "verified_at" IS NOT NULL`)
@Check('chk_receipts_voided_at', `"status" <> 'VOIDED' OR "voided_at" IS NOT NULL`)
@Check('chk_receipts_access_key_source', `"source" <> 'ACCESS_KEY' OR "access_key" IS NOT NULL`)
@Check('chk_receipts_access_key_length', `"access_key" IS NULL OR char_length("access_key") = 49`)
@Index('idx_receipts_company_payment', ['companyId', 'paymentStatus'])
@Check('chk_receipts_paid_total', `"paid_total" >= 0 AND "paid_total" <= "total"`)
export class Receipt {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Correlativo interno por empresa. Inmutable. */
    @Column({ type: 'int', update: false })
    code!: number;

    @Column({ name: 'branch_id', type: 'uuid' })
    branchId!: string;

    @Column({ type: 'enum', enum: ReceiptStatus, default: ReceiptStatus.REGISTERED })
    status!: ReceiptStatus;

    @Column({ type: 'enum', enum: ReceiptSource, default: ReceiptSource.MANUAL })
    source!: ReceiptSource;

    @Column({ name: 'document_type_id', type: 'uuid' })
    documentTypeId!: string;

    @Column({ name: 'supplier_id', type: 'uuid' })
    supplierId!: string;

    /** Número del documento del proveedor. Nulo en recibos que no lo tienen. */
    @Column({ name: 'document_number', length: 50, nullable: true })
    documentNumber?: string;

    @Column({ name: 'issue_date', type: 'date' })
    issueDate!: string;

    // ───────── Idempotencia ─────────

    @Column({ name: 'client_request_id', type: 'uuid', update: false })
    clientRequestId!: string;

    /** SHA-256 del contenido normalizado (sin el clientRequestId). */
    @Column({ name: 'request_hash', length: 64, update: false })
    requestHash!: string;

    // ───────── Importación por clave de acceso (previsto, nulo por ahora) ─────────

    @Column({ name: 'access_key', length: 49, nullable: true })
    accessKey?: string;

    @Column({ name: 'authorization_number', length: 49, nullable: true })
    authorizationNumber?: string;

    @Column({ name: 'authorization_date', type: 'timestamptz', nullable: true })
    authorizationDate?: Date;

    /** Key en S3 del XML original autorizado. */
    @Column({ name: 'xml_file_key', length: 500, nullable: true })
    xmlFileKey?: string;

    // ───────── Totales informativos (los calcula el servidor) ─────────

    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    subtotal!: string;

    @Column({ name: 'discount_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
    discountTotal!: string;

    @Column({ name: 'tax_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
    taxTotal!: string;

    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    total!: string;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    // ───────── Trazabilidad (usuarios replicados, sin FK) ─────────

    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @Column({ name: 'verified_by_id', type: 'uuid', nullable: true })
    verifiedById?: string;

    @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
    verifiedAt?: Date;

    @Column({ name: 'voided_by_id', type: 'uuid', nullable: true })
    voidedById?: string;

    @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
    voidedAt?: Date;

    @Column({ name: 'void_reason', type: 'text', nullable: true })
    voidReason?: string;

    // ───────── Relaciones ─────────

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @ManyToOne(() => BranchReplica)
    @JoinColumn({ name: 'branch_id' })
    branch!: BranchReplica;

    @ManyToOne(() => ReceiptDocumentType, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'document_type_id' })
    documentType!: ReceiptDocumentType;

    @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'supplier_id' })
    supplier!: Supplier;

    @OneToMany(() => ReceiptLine, (l) => l.receipt)
    lines!: ReceiptLine[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
    @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
    paymentStatus!: PaymentStatus;

    /** Último cambio de estado de pago (el detalle está en receipt_payment_events). */
    @Column({ name: 'payment_updated_at', type: 'timestamptz', nullable: true })
    paymentUpdatedAt?: Date;

    @Column({ name: 'payment_updated_by_id', type: 'uuid', nullable: true })
    paymentUpdatedById?: string;

    @Column({ name: 'paid_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
    paidTotal!: string;
} 