// microservices/orders/src/order-part-requests/entities/part-request.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    OneToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { Order } from '../../order-workflow/entities/order.entity';
import { Attachment } from '../../order-findings/entities/attachment.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { PartRequestPayment } from './part-request-payment.entity';
import { PartRequestStatusHistory } from './part-request-status-history.entity';
import { PartRequestSourcing } from './part-request-sourcing.entity';
import { PartRequestShipping } from './part-request-shipping.entity';
import { PartRequestArrival } from './part-request-arrival.entity';
import { PartRequestStatus, PartRequestType } from './enums/part-request-status.enum';

@Entity('part_requests')
export class PartRequest {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index()
    @Column({ nullable: true })
    order_id!: number;

    @ManyToOne(() => Order, { nullable: true })
    @JoinColumn({ name: 'order_id' })
    order?: Order;

    @Column({ type: 'uuid', unique: true, nullable: true })
    public_id?: string;

    @Column({ type: 'uuid' })
    technician_id!: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'technician_id' })
    technician!: UserEmployeeCache;

    @Column({ type: 'varchar', length: 500 })
    descripcion!: string;

    // ─── Datos técnicos (capturados al crear la solicitud) ───────────
    @Column({ default: 'N/A' })
    marca!: string;

    @Column({ default: 'N/A' })
    modelo!: string;

    @Column({ nullable: true })
    modelo_tecnico?: string;

    @Column({ default: 'N/A' })
    tipo!: string; // ⚠️ ojo: distinto del PartRequestType (NACIONAL/INTERNACIONAL) — ver nota abajo

    @Column({ nullable: true })
    color?: string;

    @Column({ nullable: true })
    calidad?: string;

    // ─── Precio de venta (editable en registrar-envío y aprobar-llegada) ──
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    precio_venta?: number;

    @Column({ type: 'enum', enum: PartRequestType, nullable: true })
    tipoRepuesto?: PartRequestType; // renombrado para no chocar con la columna "tipo" de arriba

    @Index()
    @Column({ type: 'enum', enum: PartRequestStatus, default: PartRequestStatus.SOLICITADO })
    estado!: PartRequestStatus;

    @Column({ type: 'uuid', nullable: true })
    responsable_busqueda_id?: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true, nullable: true })
    @JoinColumn({ name: 'responsable_busqueda_id' })
    responsableBusqueda?: UserEmployeeCache;

    @Column({ type: 'uuid', nullable: true })
    responsable_recepcion_id?: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true, nullable: true })
    @JoinColumn({ name: 'responsable_recepcion_id' })
    responsableRecepcion?: UserEmployeeCache;

    @OneToOne(() => PartRequestSourcing, (s) => s.partRequest)
    sourcing?: PartRequestSourcing;

    @OneToOne(() => PartRequestShipping, (s) => s.partRequest)
    shipping?: PartRequestShipping;

    @OneToOne(() => PartRequestArrival, (a) => a.partRequest)
    arrival?: PartRequestArrival;

    @OneToMany(() => PartRequestPayment, (pago) => pago.partRequest, { cascade: true })
    pagos!: PartRequestPayment[];

    @OneToMany(() => PartRequestStatusHistory, (hist) => hist.partRequest, { cascade: true })
    historial!: PartRequestStatusHistory[];

    attachments?: Attachment[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}