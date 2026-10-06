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
    Check,
} from 'typeorm';
import { PartRequest } from './part-request.entity';
import { Provider } from './provider.entity';
import { TravelItemMode, TravelItemStatus } from './enums/travel-item.enum';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

@Entity('part_request_travel_items')
@Index(['part_request_id'], { unique: true, where: `"status" = 'PENDIENTE'` })
@Check(
    'CHK_travel_item_has_source',
    `"part_request_id" IS NOT NULL OR "descripcion" IS NOT NULL`,
)
export class PartRequestTravelItem {
    @PrimaryGeneratedColumn()
    id!: number;

    // ─── Multi-tenant ────────────────────────────────────────────
    @Index()
    @Column({ type: 'uuid' })
    company_id!: string;

    // ─── Solicitud (null en ítems standalone) ────────────────────
    @Column({ type: 'int', nullable: true })
    part_request_id?: number | null;

    @ManyToOne(() => PartRequest, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'part_request_id' })
    partRequest?: PartRequest | null;

    // ─── Datos propios (solo para ítems SIN solicitud) ───────────
    // Cuando part_request_id existe, los datos salen de la solicitud y estos quedan en null.
    @Column({ type: 'varchar', length: 500, nullable: true })
    descripcion?: string | null;

    @Column({ type: 'varchar', nullable: true })
    marca?: string | null;

    @Column({ type: 'varchar', nullable: true })
    modelo?: string | null;

    @Column({ type: 'varchar', nullable: true })
    modelo_tecnico?: string | null;

    @Column({ type: 'varchar', nullable: true })
    tipo?: string | null;

    @Column({ type: 'varchar', nullable: true })
    color?: string | null;

    @Column({ type: 'varchar', nullable: true })
    calidad?: string | null;

    // ─── Datos que llena la oficina ──────────────────────────────
    @Column({ type: 'enum', enum: TravelItemMode })
    mode!: TravelItemMode;

    @Column({ type: 'enum', enum: TravelItemStatus, default: TravelItemStatus.PENDIENTE })
    status!: TravelItemStatus;

    @Column({ type: 'int', default: 1 })
    expected_quantity!: number;

    @Column({ type: 'int', nullable: true })
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



    @ManyToOne(() => UserEmployeeCache, { nullable: true })
    @JoinColumn({ name: 'collected_by_id' })
    traveler?: UserEmployeeCache | null;
}