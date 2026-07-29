// src/spare-assignments/entities/spare-cancellation-request.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum SpareCancellationStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    REJECTED = 'REJECTED',
    FAILED = 'FAILED',
}

@Entity('spare_cancellation_requests')
@Index(['order_id'])
@Index(['status'])
@Index(['movement_id'])
@Index(['spare_assignment_id']) // para el join informativo, no para integridad
export class SpareCancellationRequest {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'uuid', unique: true })
    request_id: string;

    // Referencia NATURAL al movimiento en Mongo (fuente de verdad).
    // Esta es la que se usa para correlacionar la respuesta de Kafka.
    @Column({ type: 'varchar' })
    movement_id: string;

    // Referencia al _id de Mongo del documento orderFindingSpare al momento
    // de solicitar la cancelación. Es SOLO trazabilidad/join de conveniencia
    // (ej: UI, reportes) — NUNCA una FK física a propósito: spare_assignments
    // es una réplica que el job bulk puede truncar/reescribir libremente,
    // y esa operación no debe verse bloqueada ni afectada por esta tabla.
    // Puede quedar apuntando a un registro que ya no existe; eso es esperado.
    @Column({ type: 'varchar', nullable: true })
    spare_assignment_id: string | null;

    @Column()
    order_id: number;

    // Snapshot de los datos al momento de solicitar la cancelación.
    @Column({ type: 'varchar' })
    sku: string;

    @Column({ type: 'varchar' })
    product_name: string;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    unit_price: number;

    @Column({
        type: 'varchar',
        enum: SpareCancellationStatus,
        default: SpareCancellationStatus.PENDING,
    })
    status: SpareCancellationStatus;

    @Column({ type: 'uuid', nullable: true })
    requested_by_id: string | null;

    @Column({ type: 'varchar', nullable: true })
    reason: string | null;

    @Column({ type: 'varchar', nullable: true })
    reversal_movement_id: string | null;

    @Column({ type: 'text', nullable: true })
    error_detail: string | null;

    @Column({ type: 'int', default: 0 })
    retry_count: number;

    @Column({ type: 'timestamp', nullable: true })
    confirmed_at: Date | null;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;
}