// microservices/orders/src/invoices/entities/order-invoice-batch.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

/**
 * Réplica local de cada batch/dispositivo que se vendió en una factura.
 *
 * Se llena cuando el MS de Billing publica INVOICE_ISSUED/SALE_CONFIRMED
 * con items que tenían `orderPublicId` en su batch. Sirve para que el MS
 * de Órdenes sepa qué batch específico se vendió y a qué orden pertenecía.
 *
 * Es una tabla APARTE de OrderInvoice: OrderInvoice guarda la factura
 * (1 fila por factura), y OrderInvoiceBatch guarda cada línea/batch
 * vendido (N filas por factura).
 */
@Index(['order_id'])
@Index(['invoice_id'])
@Index(['order_public_id'])
@Index(['batch_id'], { unique: true })   // un batch solo se vende una vez
@Entity('order_invoice_batches')
export class OrderInvoiceBatch {
    @PrimaryGeneratedColumn()
    id: number;

    // FK lógica a order_invoices.order_id
    @Column({ type: 'int' })
    order_id: number;

    // FK lógica al legacy_invoice_id de order_invoices
    @Column({ type: 'varchar', length: 100 })
    invoice_id: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    invoice_number: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    code_establecimiento: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    code_punto_emision: string | null;

    // 🔑 El orderPublicId que venía en el batch
    @Column({ type: 'varchar', length: 100, nullable: true })
    order_public_id: string | null;

    // 🔑 El _id del batch en Mongo (legacy)
    @Column({ type: 'varchar', length: 100 })
    batch_id: string;

    @Column({ type: 'int', nullable: true })
    batch_number: number | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    sku: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    product_name: string | null;

    // 🔑 Si el batch era un dispositivo COMPLETO o PARTE
    @Column({ type: 'boolean', default: false })
    is_complete_device: boolean;

    // 🔑 Si es repuesto, a dónde va (CLEAN, LOST, null)
    @Column({ type: 'varchar', length: 20, nullable: true })
    parts_destino: string | null;

    // IMEIs / seriales del batch
    @Column({ type: 'jsonb', default: [] })
    identifiers: string[];

    // Montos
    @Column({ type: 'numeric', precision: 12, scale: 6, default: 0 })
    quantity: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    unit_price: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    discount: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    subtotal: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    total: number;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;
}