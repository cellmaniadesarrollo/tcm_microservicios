import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';


/**
 * Tipo de documento con el que llega un ingreso (Factura, Recibo, etc.).
 * Sirve para identificar qué documento vino; NO tiene interpretación fiscal.
 * Lo único que decide es si el lote nace facturable (forcesBillableLot).
 *
 * code y name se heredan del legacy y no se editan (para no perder la referencia).
 */
@Entity('receipt_document_types')
@Index('uq_receipt_document_types_company_code', ['companyId', 'code'], { unique: true })
export class ReceiptDocumentType {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Ej: 01, 03, S/N. Inmutable. */
    @Column({ length: 10, update: false })
    code!: string;

    /** Ej: FACTURA, RECIBOS. */
    @Column({ length: 150 })
    name!: string;

    /**
     * true  -> todos los lotes del ingreso nacen con billable_in_sales = true y el usuario no lo cambia.
     * false -> el usuario decide por línea (precargado desde el producto).
     */
    @Column({ name: 'forces_billable_lot', default: false })
    forcesBillableLot!: boolean;

    /** true = sembrado por el sistema, no se puede borrar. */
    @Column({ name: 'is_system', default: false })
    isSystem!: boolean;

    @Column({ default: true })
    status!: boolean;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}