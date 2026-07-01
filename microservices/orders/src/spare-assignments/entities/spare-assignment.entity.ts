// src/spare-assignments/entities/spare-assignment.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
} from 'typeorm';

@Entity('spare_assignments')
@Index(['order_id'])
@Index(['status'])
export class SpareAssignment {

    @PrimaryGeneratedColumn()
    id: number;

    // Referencia al documento MongoDB (trazabilidad)
    @Column({ type: 'varchar', unique: true })
    movement_id: string; // ObjectId del movimiento en MongoDB

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

    @Column({ type: 'varchar', enum: ['active', 'returned'], default: 'active' })
    status: string;

    @Column({ type: 'timestamp', nullable: true })
    returned_at: Date | null;

    // ── Timestamps de la FUENTE DE VERDAD (Mongo), no de la réplica ──
    @Column({ type: 'timestamp' })
    created_at: Date;

    @Column({ type: 'timestamp' })
    updated_at: Date;
}