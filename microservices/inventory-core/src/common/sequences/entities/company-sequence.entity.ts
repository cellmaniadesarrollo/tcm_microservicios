import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Correlativos por empresa. Una fila por (empresa, clave).
 * Claves previstas: 'product_code', luego 'income_number', 'batch:<productId>', etc.
 * Se incrementa con un UPDATE ... RETURNING atómico dentro de la transacción.
 */
@Entity('company_sequences')
export class CompanySequence {
    @PrimaryColumn({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @PrimaryColumn({ length: 100 })
    key!: string;

    @Column({ name: 'last_value', type: 'int', default: 0 })
    lastValue!: number;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}