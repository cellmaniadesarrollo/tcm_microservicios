import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('colors')
@Unique('uq_colors_company_name', ['companyId', 'name'])
export class Color {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ length: 100 })
    name!: string;

    @Column({ length: 7, nullable: true })
    hex?: string; // ej: #1A1A1A

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