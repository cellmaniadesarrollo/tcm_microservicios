import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { ReasonOrderLink, VoucherDirection } from '../enums/stock-voucher.enums';

/**
 * Catálogo de motivos de movimiento manual (por empresa).
 * Reemplaza a name_movement / name_movementtype del legacy.
 */
@Entity('stock_movement_reasons')
@Index('uq_stock_movement_reasons_company_code', ['companyId', 'code'], { unique: true })
export class StockMovementReason {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ length: 30 })
    code!: string;

    @Column({ length: 100 })
    name!: string;

    @Column({ type: 'enum', enum: VoucherDirection })
    direction!: VoucherDirection;

    @Column({ name: 'order_link', type: 'enum', enum: ReasonOrderLink })
    orderLink!: ReasonOrderLink;

    /** Solo OUT: si la salida admite retorno. */
    @Column({ name: 'is_returnable', default: false })
    isReturnable!: boolean;

    @Column({ name: 'is_system', default: false })
    isSystem!: boolean;

    @Column({ default: true })
    status!: boolean;

    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder!: number;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}