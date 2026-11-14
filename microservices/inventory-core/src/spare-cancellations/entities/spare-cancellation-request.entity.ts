import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CancellationStatus {
    PENDING = 'PENDING',     // pedida por órdenes, a la espera del retorno físico
    CONFIRMED = 'CONFIRMED', // el retorno total ya se registró (paso 10)
    REJECTED = 'REJECTED',   // no procede (error_detail dice por qué)
}

/**
 * Solicitud de cancelación que llega desde el MS de órdenes sobre una asignación
 * 'inventory-core'. NO mueve stock: solo registra la intención. Se cierra cuando
 * bodega registra el retorno total de la línea.
 * movement_id = id de la línea de salida (lo manda órdenes tal cual; sin FK a propósito).
 */
@Entity('spare_cancellation_requests')
@Index('uq_scr_request_id', ['requestId'], { unique: true })
// Una sola solicitud PENDING por línea (red final contra carreras)
@Index('uq_scr_pending_movement', ['movementId'], { unique: true, where: `"status" = 'PENDING'` })
@Index('idx_scr_company', ['companyId'])
export class SpareCancellationRequest {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'request_id', type: 'uuid' })
    requestId!: string;

    /** Nulo si la línea no existe (no hay a qué empresa atribuirla). */
    @Column({ name: 'company_id', type: 'uuid', nullable: true })
    companyId?: string | null;

    @Column({ name: 'movement_id', type: 'varchar', length: 100 })
    movementId!: string;

    @Column({ name: 'order_id', type: 'int' })
    orderId!: number;

    @Column({ type: 'varchar', length: 20, default: CancellationStatus.PENDING })
    status!: CancellationStatus;

    @Column({ type: 'text', nullable: true })
    reason?: string | null;

    @Column({ name: 'requested_by_id', type: 'varchar', length: 100, nullable: true })
    requestedById?: string | null;

    @Column({ name: 'error_detail', type: 'text', nullable: true })
    errorDetail?: string | null;

    @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
    confirmedAt?: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;
}