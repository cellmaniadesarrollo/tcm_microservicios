import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

/** Calidad: Original, OEM, AAA, Recuperada (desguace)... */
@Entity('qualities')
@Unique('uq_qualities_company_code', ['companyId', 'code'])
@Unique('uq_qualities_company_name', ['companyId', 'name'])
export class Quality {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Clave estable para el código (ej. RECOVERED). No cambia aunque el usuario renombre `name`. */
    @Column({ length: 30 })
    code!: string;

    @Column({ length: 100 })
    name!: string;

    /** true para las que el sistema necesita (ej. RECOVERED en ingresos por desguace). No se pueden borrar. */
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