import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

/** Catálogo de nombres de producto por empresa. Evita duplicados por mayúsculas, tildes o espacios. */
@Entity('product_names')
@Index('uq_product_names_company_key', ['companyId', 'normalizedKey'], { unique: true })
export class ProductName {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Nombre tal como se muestra en los selects. */
    @Column({ length: 255 })
    name!: string;

    /** Forma comparable (minúsculas, sin tildes ni signos). Se calcula siempre con normalizeNameKey. */
    @Column({ name: 'normalized_key', length: 255 })
    normalizedKey!: string;

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