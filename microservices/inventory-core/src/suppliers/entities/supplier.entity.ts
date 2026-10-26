import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Index, Check,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
// AJUSTA la ruta a donde quedó Country en tu módulo de catálogos generales
import { Country } from '../../catalogs/entities/country.entity';
import { IdentificationType } from '../enums/supplier.enums';

/**
 * Proveedor (por empresa). Puede ser nacional o internacional.
 *
 * code -> correlativo numérico por empresa. Inmutable.
 * (identificationType, identificationNumber) es único por empresa: es lo que evita duplicados
 * y, más adelante, lo que permite reconocer al proveedor desde el RUC de una clave de acceso.
 *
 * Fuera de esta versión (se agregan como columnas nulables cuando hagan falta):
 * régimen del contribuyente, condiciones de pago, datos bancarios, retenciones.
 */
@Entity('suppliers')
@Index('uq_suppliers_company_code', ['companyId', 'code'], { unique: true })
@Index('uq_suppliers_company_identification', ['companyId', 'identificationType', 'identificationNumber'], { unique: true })
@Index('idx_suppliers_company_status', ['companyId', 'status'])
@Index('idx_suppliers_country', ['countryId'])
@Check('chk_suppliers_identification_not_empty', `char_length(trim("identification_number")) > 0`)
export class Supplier {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ type: 'int', update: false })
    code!: number;

    @Column({ name: 'identification_type', type: 'enum', enum: IdentificationType })
    identificationType!: IdentificationType;

    /** Se guarda normalizado (sin espacios en los extremos). */
    @Column({ name: 'identification_number', length: 50 })
    identificationNumber!: string;

    /** Razón social (antes `razon_social`). */
    @Column({ name: 'business_name', length: 200 })
    businessName!: string;

    @Column({ name: 'trade_name', length: 200, nullable: true })
    tradeName?: string;

    @Column({ name: 'country_id', type: 'uuid' })
    countryId!: string;

    @Column({ length: 255 })
    address!: string;

    @Column({ length: 30, nullable: true })
    phone?: string;

    @Column({ length: 150, nullable: true })
    email?: string;

    @Column({ default: true })
    status!: boolean;

    // ───────── Relaciones ─────────

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @ManyToOne(() => Country, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'country_id' })
    country!: Country;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}