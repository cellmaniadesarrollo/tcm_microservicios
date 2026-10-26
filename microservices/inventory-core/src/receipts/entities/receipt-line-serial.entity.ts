import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ReceiptLine } from './receipt-line.entity';

/**
 * Seriales/IMEI de una línea mientras el ingreso es borrador.
 * Al confirmar pasan a stock_units. Obligatorio para productos SERIAL (y todo DEVICE):
 * cantidad de la línea = cantidad de seriales (se valida en el servicio).
 * Se guardan normalizados: sin espacios en los extremos y en mayúsculas.
 */
@Entity('receipt_line_serials')
export class ReceiptLineSerial {
    @PrimaryColumn({ name: 'receipt_line_id', type: 'uuid' })
    receiptLineId!: string;

    @PrimaryColumn({ length: 100 })
    serial!: string;

    @ManyToOne(() => ReceiptLine, (l) => l.serials, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receipt_line_id' })
    line!: ReceiptLine;
}