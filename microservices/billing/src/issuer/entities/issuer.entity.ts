import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Emisor (tabla 11 del SRI, campos a nivel de RUC). */
@Entity('issuers')
@Index('uq_issuers_company_ruc', ['companyId', 'ruc'], { unique: true })
export class Issuer {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;

  @Column({ type: 'varchar', length: 13 }) ruc!: string;
  @Column({ name: 'legal_name', type: 'varchar', length: 300 }) legalName!: string;
  @Column({ name: 'trade_name', type: 'varchar', length: 300, nullable: true }) tradeName!: string | null;
  @Column({ name: 'headquarters_address', type: 'varchar', length: 300 }) headquartersAddress!: string;
  @Column({ name: 'special_taxpayer', type: 'varchar', length: 5, nullable: true }) specialTaxpayer!: string | null;
  @Column({ name: 'accounting_required', type: 'boolean', default: false }) accountingRequired!: boolean;
  /** Key de S3, nunca una URL. Se llena en el paso del logo. */
  @Column({ name: 'logo_key', type: 'varchar', length: 500, nullable: true }) logoKey!: string | null;
  /** 1 pruebas, 2 producción. */
  @Column({ type: 'smallint', default: 1 }) environment!: number;
  /** 1 normal. */
  @Column({ name: 'emission_type', type: 'smallint', default: 1 }) emissionType!: number;
  @Column({ type: 'boolean', default: true }) active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}