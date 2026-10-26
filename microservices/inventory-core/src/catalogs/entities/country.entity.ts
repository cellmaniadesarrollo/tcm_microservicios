import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Catálogo GLOBAL de países (no pertenece a una empresa).
 * code = ISO 3166-1 alfa-2 (EC, PE, CO, CN, US). Se siembra al iniciar el servicio.
 */
@Entity('countries')
@Index('uq_countries_code', ['code'], { unique: true })
export class Country {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ length: 2 })
    code!: string;

    @Column({ length: 100 })
    name!: string;

    @Column({ default: true })
    status!: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}