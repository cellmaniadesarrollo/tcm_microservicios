import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Punto de emisión (caja/terminal) de una sucursal. Es la segunda mitad de la serie: 001 + 001. */
@Entity('emission_points')
@Index('uq_emission_points_branch_code', ['branchId', 'code'], { unique: true })
@Index('uq_emission_points_default', ['branchId'], { unique: true, where: '"is_default" = true' })
export class EmissionPoint {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;

  @Column({ type: 'varchar', length: 3 }) code!: string;
  @Column({ type: 'varchar', length: 100 }) name!: string;

  @Column({ name: 'is_default', type: 'boolean', default: false }) isDefault!: boolean;
  @Column({ type: 'boolean', default: true }) active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}