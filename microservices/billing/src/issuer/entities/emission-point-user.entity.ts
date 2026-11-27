import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Empleado autorizado a emitir con un punto de emisión. */
@Entity('emission_point_users')
@Index('uq_emission_point_users', ['emissionPointId', 'userId'], { unique: true })
@Index('ix_emission_point_users_user', ['companyId', 'userId'])
export class EmissionPointUser {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @Column({ name: 'emission_point_id', type: 'uuid' }) emissionPointId!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}