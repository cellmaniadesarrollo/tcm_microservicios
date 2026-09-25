// microservices/orders/src/order-part-requests/entities/part-request-travel-item.entity.ts

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
import { PartRequest } from './part-request.entity';
import { Provider } from './provider.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { TravelItemMode, TravelItemStatus } from './enums/travel-item.enum';

@Entity('part_request_travel_items')
@Index(['traveler_id', 'status'])
@Index(['part_request_id'], { unique: true, where: `"status" = 'PENDIENTE'` })
export class PartRequestTravelItem {
    @PrimaryGeneratedColumn()
    id!: number;

    // ─── Multi-tenant ────────────────────────────────────────────
    @Index()
    @Column({ type: 'uuid' })
    company_id!: string;

    // ─── Solicitud ───────────────────────────────────────────────
    @Column()
    part_request_id!: number;

    @ManyToOne(() => PartRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

    // ─── Viajero asignado ────────────────────────────────────────
    @Column({ type: 'uuid' })
    traveler_id!: string;

    @ManyToOne(() => UserEmployeeCache)
    @JoinColumn({ name: 'traveler_id' })
    traveler!: UserEmployeeCache;

    // ─── Datos que llena la oficina ──────────────────────────────
    @Column({ type: 'enum', enum: TravelItemMode })
    mode!: TravelItemMode;

    @Column({ type: 'enum', enum: TravelItemStatus, default: TravelItemStatus.PENDIENTE })
    status!: TravelItemStatus;

    @Column({ type: 'int', default: 1 })
    expected_quantity!: number;

    @Column({ nullable: true })
    suggested_provider_id?: number | null;

    @ManyToOne(() => Provider, { nullable: true })
    @JoinColumn({ name: 'suggested_provider_id' })
    suggestedProvider?: Provider | null;

    @Column({ type: 'text', nullable: true })
    office_notes?: string | null;

    @Column({ type: 'uuid' })
    assigned_by_id!: string;

    // ─── Datos que llena el viajero (paso siguiente) ─────────────
    @Column({ type: 'int', nullable: true })
    collected_quantity?: number | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    paid_cost?: number | null;

    @Column({ type: 'text', nullable: true })
    traveler_notes?: string | null;

    @Column({ type: 'timestamp', nullable: true })
    collected_at?: Date | null;

    @Column({ type: 'uuid', nullable: true })
    collected_by_id?: string | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}