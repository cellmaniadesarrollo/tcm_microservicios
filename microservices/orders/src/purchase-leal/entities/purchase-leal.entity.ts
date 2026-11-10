import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

@Entity('purchase_leads')
@Index(['company_id', 'customer_id_number'], { unique: false })
export class PurchaseLead {
  @PrimaryGeneratedColumn()
  id!: number;

  // ─── Empresa / Sucursal ───────────────────────────────────────────────────

  @Column({ type: 'uuid' })
  company_id!: string;

  @ManyToOne(() => CompanyReplica, { eager: true })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyReplica;

  @Column({ type: 'uuid' })
  branch_id!: string;

  @ManyToOne(() => BranchReplica, { eager: true })
  @JoinColumn({ name: 'branch_id' })
  branch!: BranchReplica;

  // ─── Datos del cliente (snapshot — no FK a customers_cache) ──────────────
  // Se guarda el ID del cache por referencia blanda, pero los datos
  // se copian para que el lead sea autocontenido.

  @Column({ nullable: true })
  customer_cache_id?: number; // referencia opcional al cache

  @Column({ type: 'varchar', length: 30 })
  customer_id_number!: string; // cédula / RUC / pasaporte

  @Column({ type: 'varchar', length: 50, nullable: true })
  customer_id_type_name?: string;

  @Column({ type: 'varchar', length: 100 })
  customer_first_name!: string;

  @Column({ type: 'varchar', length: 100 })
  customer_last_name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customer_email?: string;

  // ─── Datos del dispositivo (snapshot — equipo NO ingresa al sistema) ──────

  @Column({ nullable: true })
  device_type_id?: number; // ID del DeviceType (catálogo)

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_type_name?: string; // nombre legible (CELLPHONE, TABLET…)

  @Column({ nullable: true })
  brand_id?: number; // ID del Brand (catálogo)

  @Column({ type: 'varchar', length: 255, nullable: true })
  brand_name?: string;

  @Column({ nullable: true })
  model_id?: number; // ID del Model (catálogo)

  @Column({ type: 'varchar', length: 255, nullable: true })
  model_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_imei?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_color?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_storage?: string; // "128GB", "256GB"…

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_condition?: string; // "Bueno", "Regular", "Dañado"…

  // ─── Detalles de la oferta / interés ─────────────────────────────────────

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  offered_price?: number; // precio que ofrece el cliente

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimated_purchase_price?: number; // precio interno estimado

  @Column({ type: 'text', nullable: true })
  notes?: string; // observaciones adicionales

  @Column({ default: false })
  is_contacted!: boolean; // ya fue llamado/contactado?

  @Column({ type: 'timestamp', nullable: true })
  contacted_at?: Date;

  @Column({ default: false })
  is_closed!: boolean; // se concretó la compra?

  @Column({ type: 'timestamp', nullable: true })
  closed_at?: Date;

  // ─── Quién registró ───────────────────────────────────────────────────────

  @Column({ type: 'uuid' })
  created_by_id!: string;

  @ManyToOne(() => UserEmployeeCache, { eager: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: UserEmployeeCache;

  // ─── Timestamps ───────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}