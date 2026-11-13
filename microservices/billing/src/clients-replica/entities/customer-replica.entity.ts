import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Réplica de clientes de ms-clients. Sin FK. Incluye inactivos. */
@Entity('customers_replica')
@Index('idx_customers_replica_company_idnumber', ['companyId', 'idNumber'])
@Index('idx_customers_replica_updated', ['updatedAt'])
export class CustomerReplica {
    @PrimaryColumn({ type: 'int' })
    id!: number;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'id_type_id', type: 'int' })
    idTypeId!: number;

    /** Código SRI (04, 05, 06, 07, 08) */
    @Column({ name: 'id_type_code', type: 'varchar', length: 10, nullable: true })
    idTypeCode!: string | null;

    @Column({ name: 'id_type_name', type: 'varchar', length: 50, nullable: true })
    idTypeName!: string | null;

    @Column({ name: 'id_number', length: 30 })
    idNumber!: string;

    @Column({ name: 'first_name', length: 100 })
    firstName!: string;

    @Column({ name: 'last_name', length: 100 })
    lastName!: string;

    @Column({ name: 'birth_date', type: 'date', nullable: true })
    birthDate!: string | null;

    @Column({ name: 'gender_name', type: 'varchar', length: 20, nullable: true })
    genderName!: string | null;

    @Column({ name: 'is_active', default: true })
    isActive!: boolean;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    addresses!: unknown[];

    @Column({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    /** Fecha de actualización en ms-clients (guard de orden). */
    @Column({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;

    @Column({ name: 'synced_at', type: 'timestamptz', default: () => 'now()' })
    syncedAt!: Date;
}