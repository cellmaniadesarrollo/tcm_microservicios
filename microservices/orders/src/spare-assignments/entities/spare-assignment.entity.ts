// src/spare-assignments/entities/spare-assignment.entity.ts
import {
    Entity,
    PrimaryColumn,
    Column,
    Index,
} from 'typeorm';

export enum SpareAssignmentStatus {
    ACTIVE = 'active',
    CANCELLATION_REQUESTED = 'cancellation_requested',
    RETURNED = 'returned',
}

@Entity('spare_assignments')
@Index(['order_id'])
@Index(['status'])
export class SpareAssignment {

    // _id del documento orderFindingSpare en Mongo (fuente de verdad).
    // NO autoincremental: es determinístico, así que un truncate/reconciliación
    // del bulk siempre reproduce el mismo id. Elimina el riesgo de que este
    // valor "cambie de significado" entre syncs, a diferencia del serial de Postgres.
    @PrimaryColumn({ type: 'varchar' })
    id: string;

    @Column({ type: 'varchar', unique: true })
    movement_id: string;

    @Column()
    order_id: number;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'varchar' })
    sku: string;

    @Column({ type: 'varchar' })
    product_name: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    unit_price: number;

    @Column({ type: 'int' })
    batch_number: number;

    @Column({
        type: 'varchar',
        enum: SpareAssignmentStatus,
        default: SpareAssignmentStatus.ACTIVE,
    })
    status: SpareAssignmentStatus;

    @Column({ type: 'uuid', nullable: true })
    cancellation_request_id: string | null;

    @Column({ type: 'timestamp', nullable: true })
    returned_at: Date | null;

    @Column({ type: 'timestamp' })
    created_at: Date;

    @Column({ type: 'timestamp' })
    updated_at: Date;
}