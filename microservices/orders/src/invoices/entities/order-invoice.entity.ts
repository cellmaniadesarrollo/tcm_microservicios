// src/invoices/entities/order-invoice.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum InvoiceEmissionStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    ERROR = 'ERROR',
}

@Index(['order_id'], { unique: true })
@Index(['status'])
@Index(['updatedAt'])
@Entity('order_invoices')
export class OrderInvoice {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    order_id: number;

    @Column({ type: 'uuid' })
    company_id: string;

    @Column({ type: 'uuid' })
    branch_id: string;

    @Column({ type: 'uuid' })
    closed_by_user_id: string;

    @Column({ type: 'int', nullable: true })
    payment_method_id: number;

    @Column({ type: 'varchar', length: 20, default: 'FACTURA' })
    type_id: string;

    // ── Snapshot mínimo de billing ──
    @Column({ type: 'varchar', length: 24 })
    billing_id: string;

    @Column({ type: 'varchar', length: 200 })
    billing_name: string;

    @Column({ type: 'varchar', length: 30 })
    billing_id_number: string;

    // ── Líneas de la factura ──
    @Column({ type: 'jsonb' })
    details: {
        movement_id?: string;
        service_code?: string;
        quantity: number;
        discount: number;
        unit_price: number;
    }[];

    // ── Reconciliación con legacy ──
    @Column({ type: 'enum', enum: InvoiceEmissionStatus, default: InvoiceEmissionStatus.PENDING })
    status: InvoiceEmissionStatus;

    // ⬇️ AGREGA AQUÍ LAS COLUMNAS QUE TE FALTAN ⬇️
    @Column({ type: 'varchar', length: 100, nullable: true })
    legacy_invoice_id: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    legacy_invoice_number: string | null;

    @Column({ type: 'timestamp', nullable: true })
    legacy_issue_date: Date | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
    legacy_subtotal: number | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
    legacy_total: number | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    legacy_clave_acceso: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    legacy_code_establecimiento: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    legacy_code_punto_emision: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    legacy_payment_code: string | null;

    @Column({ type: 'jsonb', nullable: true })
    legacy_sri_response: any;

    @Column({ type: 'varchar', length: 500, nullable: true })
    error_message: string | null;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;
}