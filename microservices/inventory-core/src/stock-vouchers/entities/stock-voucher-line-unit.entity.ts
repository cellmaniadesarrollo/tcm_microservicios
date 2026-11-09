import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { StockUnit } from '../../stock/entities/stock-unit.entity';
import { StockVoucherLine } from './stock-voucher-line.entity';

/** Qué unidades físicas (IMEI/serial) se movieron en una línea de productos serializados. */
@Entity('stock_voucher_line_units')
@Index('idx_stock_voucher_line_units_unit', ['unitId'])
export class StockVoucherLineUnit {
    @PrimaryColumn({ name: 'line_id', type: 'uuid' })
    lineId!: string;

    @PrimaryColumn({ name: 'unit_id', type: 'uuid' })
    unitId!: string;

    @ManyToOne(() => StockVoucherLine, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'line_id' })
    line!: StockVoucherLine;

    @ManyToOne(() => StockUnit, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'unit_id' })
    unit!: StockUnit;
}