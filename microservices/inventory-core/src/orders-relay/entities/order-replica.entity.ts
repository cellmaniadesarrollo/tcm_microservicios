import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Réplica mínima de la orden. Datos "fijos", sin normalizar.
 * El id es el MISMO id del MS origen (no se autogenera).
 */
@Entity({ name: 'orders_replica' })
@Index(['company_id', 'status_id']) // listados por empresa filtrando por estado
export class OrderReplica {
    @PrimaryColumn({ type: 'int' })
    id!: number;

    @Index()
    @Column({ type: 'int' })
    order_number!: number;

    // ── Empresa ──────────────────────────────────────────────────
    @Index()
    @Column({ type: 'varchar', length: 64 })
    company_id!: string;

    // ── Estado (desnormalizado) ──────────────────────────────────
    @Index()
    @Column({ type: 'int' })
    status_id!: number;

    @Column({ type: 'varchar', length: 100 })
    status_name!: string;

    // ── Cliente (desnormalizado) ─────────────────────────────────
    @Index()
    @Column({ type: 'int' })
    customer_id!: number;

    @Column({ type: 'varchar', length: 255 })
    customer_name!: string;

    // ── Fechas del ORIGEN (no las de esta réplica) ───────────────
    @Column({ type: 'timestamptz', nullable: true })
    source_created_at!: Date | null;

    @Index()
    @Column({ type: 'timestamptz', nullable: true })
    source_updated_at!: Date | null;

    // ── Tipo de orden (desnormalizado) ───────────────────────────
    @Column({ type: 'int', nullable: true })
    order_type_id!: number | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    order_type_name!: string | null;

    // ── Dispositivo (desnormalizado; 1 por orden) ────────────────
    @Column({ type: 'int', nullable: true })
    device_id!: number | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    device_brand!: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    device_model!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    device_type!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    device_serial!: string | null;

    // Todos los IMEI separados por espacio, solo para búsqueda
    @Column({ type: 'text', nullable: true })
    device_imeis!: string | null;
}