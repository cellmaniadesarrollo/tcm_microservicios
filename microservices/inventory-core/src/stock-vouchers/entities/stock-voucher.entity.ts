import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { VoucherDirection } from '../enums/stock-voucher.enums';
import { StockMovementReason } from './stock-movement-reason.entity';

/**
 * Vale de movimiento manual (cabecera). INMUTABLE: nunca se edita ni se borra.
 * Un error se corrige con un retorno (IN) que referencia este vale.
 *
 * employee_id            -> empleado que recibe (réplica de usuarios, sin FK).
 * order_id/order_number  -> orden de reparación (réplica de órdenes, sin FK; se vacía al reconciliar).
 * origin_voucher_id      -> solo en retornos (IN): el vale de salida que se devuelve.
 *                           Un retorno hereda empleado, orden y sucursal del vale original.
 */
@Entity('stock_vouchers')
@Index('uq_stock_vouchers_company_code', ['companyId', 'code'], { unique: true })
@Index('uq_stock_vouchers_company_client_request', ['companyId', 'clientRequestId'], { unique: true })
@Index('idx_stock_vouchers_company_order', ['companyId', 'orderId'])
@Index('idx_stock_vouchers_company_employee', ['companyId', 'employeeId'])
@Index('idx_stock_vouchers_origin', ['originVoucherId'])
@Index('idx_stock_vouchers_company_date', ['companyId', 'createdAt'])
@Check('chk_stock_vouchers_origin', `("direction" = 'IN') = ("origin_voucher_id" IS NOT NULL)`)
@Check('chk_stock_vouchers_order_pair', `("order_id" IS NULL) = ("order_number" IS NULL)`)
export class StockVoucher {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ type: 'int', update: false })
    code!: number;

    @Column({ type: 'enum', enum: VoucherDirection })
    direction!: VoucherDirection;

    @Column({ name: 'reason_id', type: 'uuid' })
    reasonId!: string;

    @Column({ name: 'branch_id', type: 'uuid' })
    branchId!: string;

    @Column({ name: 'employee_id', type: 'uuid' })
    employeeId!: string;

    @Column({ name: 'order_id', type: 'int', nullable: true })
    orderId?: number | null;

    @Column({ name: 'order_number', type: 'int', nullable: true })
    orderNumber?: number | null;

    @Column({ name: 'origin_voucher_id', type: 'uuid', nullable: true })
    originVoucherId?: string | null;

    @Column({ type: 'text', nullable: true })
    note?: string | null;

    @Column({ name: 'client_request_id', type: 'uuid' })
    clientRequestId!: string;

    @Column({ name: 'request_hash', length: 64 })
    requestHash!: string;

    @Column({ name: 'created_by_id', type: 'uuid' })
    createdById!: string;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @ManyToOne(() => StockMovementReason, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'reason_id' })
    reason!: StockMovementReason;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;
}