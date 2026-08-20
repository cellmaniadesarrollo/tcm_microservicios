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
    closed_by_user_id: string; // quien cerró la orden (= user_id enviado al legacy)

    @Column({ type: 'int', nullable: true })
    payment_method_id: number;

    @Column({ type: 'varchar', length: 20, default: 'FACTURA' })
    type_id: string; // fijo: órdenes solo emite facturas

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

    @Column({ type: 'varchar', length: 50, nullable: true })
    legacy_invoice_number: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    error_message: string;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;
}