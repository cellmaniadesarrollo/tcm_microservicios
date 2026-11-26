import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { ServiceTypeEntity } from './service-type.entity';

@Entity('services')
@Index('uq_services_company_code', ['companyId', 'code'], { unique: true })
export class ServiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Index()
  @Column({ name: 'service_type_id', type: 'uuid' })
  serviceTypeId: string;

  @ManyToOne(() => ServiceTypeEntity, (t) => t.services, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_type_id' })
  serviceType: ServiceTypeEntity;

  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Precio sin IVA. Cantidad siempre 1. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: string;

  /** Tarifa de IVA (catálogo sri_vat_rate). Nullable hasta definir cómo la usas. */
  @Column({ name: 'vat_rate_id', type: 'int', nullable: true })
  vatRateId: number | null;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}