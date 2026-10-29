import {
    Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Receipt } from './receipt.entity';
import { ReceiptLine } from './receipt-line.entity';
import { AttachmentKind } from '../enums/receipt.enums';

/**
 * Archivos de un ingreso. Guarda solo la key de S3 (el acceso es con URL firmada).
 * DOCUMENT: la factura/recibo escaneado. Uno por ingreso, sin línea.
 * PHOTO: foto de la mercadería. Pertenece a una línea (producto) del ingreso.
 */
@Entity('receipt_attachments')
@Index('idx_receipt_attachments_receipt', ['receiptId'])
@Index('idx_receipt_attachments_line', ['receiptLineId'])
// Un solo documento por ingreso (las fotos pueden ser varias)
@Index('uq_receipt_attachments_document', ['receiptId'], { unique: true, where: `"kind" = 'DOCUMENT'` })
// El documento no tiene línea; la foto siempre la tiene
@Check(
    'chk_receipt_attachments_line',
    `("kind" = 'DOCUMENT' AND "receipt_line_id" IS NULL) OR ("kind" = 'PHOTO' AND "receipt_line_id" IS NOT NULL)`,
)
export class ReceiptAttachment {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'receipt_id', type: 'uuid' })
    receiptId!: string;

    /** Solo fotos: la línea (producto) a la que pertenecen. Nulo en el documento. */
    @Column({ name: 'receipt_line_id', type: 'uuid', nullable: true })
    receiptLineId?: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ type: 'enum', enum: AttachmentKind })
    kind!: AttachmentKind;

    @Column({ name: 'file_key', length: 500 })
    fileKey!: string;

    @Column({ name: 'original_name', length: 255 })
    originalName!: string;

    @Column({ name: 'mime_type', length: 100 })
    mimeType!: string;

    @Column({ name: 'size_bytes', type: 'int' })
    sizeBytes!: number;

    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @ManyToOne(() => Receipt, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receipt_id' })
    receipt!: Receipt;

    @ManyToOne(() => ReceiptLine, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'receipt_line_id' })
    line?: ReceiptLine;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}