import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StockVoucher } from './stock-voucher.entity';
import { StockVoucherLine } from './stock-voucher-line.entity';

/**
 * Foto de una línea de vale (estado del repuesto al salir o al regresar). Solo se inserta:
 * el vale es inmutable. En BD solo va la key de S3; el acceso es con URL firmada.
 */
@Entity('stock_voucher_attachments')
@Index('idx_stock_voucher_attachments_voucher', ['voucherId'])
@Index('idx_stock_voucher_attachments_line', ['lineId'])
export class StockVoucherAttachment {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'voucher_id', type: 'uuid' })
    voucherId!: string;

    @Column({ name: 'line_id', type: 'uuid' })
    lineId!: string;

    @Column({ name: 'file_key', length: 500 })
    fileKey!: string;

    @Column({ name: 'original_name', length: 255 })
    originalName!: string;

    @Column({ name: 'mime_type', length: 100 })
    mimeType!: string;

    @Column({ name: 'size_bytes', type: 'int' })
    sizeBytes!: number;

    /** Orden dentro de su línea (base 0). */
    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @ManyToOne(() => StockVoucher, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'voucher_id' })
    voucher!: StockVoucher;

    @ManyToOne(() => StockVoucherLine, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'line_id' })
    line!: StockVoucherLine;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;
}