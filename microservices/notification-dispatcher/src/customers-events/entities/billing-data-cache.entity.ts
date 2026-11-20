import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Réplica de datos de facturación de ms-clients. Sin FK; la relación con clientes es customerIds. */
@Entity('billing_data_cache')
@Index('idx_billing_cache_company_idnumber', ['companyId', 'idNumber'])
@Index('idx_billing_cache_updated', ['updatedAt'])
export class BillingDataCache {
    @PrimaryColumn({ type: 'varchar', length: 24 })
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ name: 'id_type_id', type: 'int' })
    idTypeId!: number;

    @Column({ name: 'id_type_code', type: 'varchar', length: 10, nullable: true })
    idTypeCode!: string | null;

    @Column({ name: 'id_type_name', type: 'varchar', length: 50, nullable: true })
    idTypeName!: string | null;

    @Column({ name: 'id_number', length: 30 })
    idNumber!: string;

    @Column({ name: 'person_type_id', type: 'int' })
    personTypeId!: number;

    @Column({ name: 'person_type_name', length: 20 })
    personTypeName!: string;

    @Column({ name: 'gender_name', type: 'varchar', length: 20, nullable: true })
    genderName!: string | null;

    @Column({ name: 'first_name', length: 100 })
    firstName!: string;

    @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
    lastName!: string | null;

    @Column({ name: 'trade_name', type: 'varchar', length: 200, nullable: true })
    tradeName!: string | null;

    @Column({ name: 'main_email', length: 150 })
    mainEmail!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    cellphone!: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone!: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    birthdate!: string | null;

    @Column({ length: 300 })
    address!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    city!: string | null;

    @Column({ name: 'city_id', type: 'int', nullable: true })
    cityId!: number | null;

    @Column({ name: 'is_company_client', default: false })
    isCompanyClient!: boolean;

    @Column({ name: 'is_active', default: true })
    isActive!: boolean;

    /** IDs de customers_cache vinculados. Estado completo en cada evento. */
    @Column({ name: 'customer_ids', type: 'int', array: true, default: () => "'{}'" })
    customerIds!: number[];

    @Column({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @Column({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;

    @Column({ name: 'synced_at', type: 'timestamptz', default: () => 'now()' })
    syncedAt!: Date;
}