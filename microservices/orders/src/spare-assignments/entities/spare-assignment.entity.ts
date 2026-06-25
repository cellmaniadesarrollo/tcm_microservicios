// src/spare-assignments/entities/spare-assignment.entity.ts
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
import { OrderFinding } from '../../order-findings/entities/order-finding.entity';

@Entity('spare_assignments')
@Index(['finding_id'])
@Index(['status'])
export class SpareAssignment {

    @PrimaryGeneratedColumn()
    id: number;

    // Referencia al documento MongoDB (trazabilidad)
    @Column({ type: 'varchar', unique: true })
    movement_id: string; // ObjectId del movimiento en MongoDB

    // 🔗 Hallazgo
    @ManyToOne(() => OrderFinding, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'finding_id' })
    finding: OrderFinding;

    @Column()
    finding_id: number;

    @Column({ type: 'int' })
    quantity: number;

    // Snapshot del repuesto al momento de asignación
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

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}