import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { StockUnit } from './stock-unit.entity';

/**
 * Identificadores de una unidad física (IMEI 1, IMEI 2, serial...).
 * position 0 = principal (copia de stock_units.serial).
 * Un mismo IMEI no puede repetirse para el mismo producto en la empresa.
 */
@Entity('stock_unit_serials')
@Index('uq_stock_unit_serials_value', ['companyId', 'productId', 'value'], { unique: true })
export class StockUnitSerial {
    @PrimaryColumn({ name: 'unit_id', type: 'uuid' })
    unitId!: string;

    @PrimaryColumn({ type: 'int' })
    position!: number;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'product_id', type: 'uuid' })
    productId!: string;

    /** Normalizado: sin espacios en los extremos y en mayúsculas. */
    @Column({ length: 100 })
    value!: string;

    @ManyToOne(() => StockUnit, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'unit_id' })
    unit!: StockUnit;
}