import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('user_employee_cache')
export class UserEmployeeCache {
    // El id viene del MS de usuarios, no se genera aquí
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', nullable: true })
    username!: string | null;

    @Column({ name: 'first_name', type: 'varchar', nullable: true })
    firstName!: string | null;

    @Column({ name: 'last_name', type: 'varchar', nullable: true })
    lastName!: string | null;

    @Column({ type: 'varchar', nullable: true })
    email!: string | null;

    @Column({ name: 'is_company_admin', default: false })
    isCompanyAdmin!: boolean;

    // Sin FK a CompanyReplica, solo el id (ajusta el tipo al de tu compañía)
    @Index()
    @Column({ name: 'company_id' })
    companyId!: string;

    @Column('text', { array: true, default: () => "'{}'" })
    groups!: string[];

    @Column({ name: 'is_active', default: true })
    isActive!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    createdAt!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    updatedAt!: Date | null;
}