// microservices/orders/src/order-part-requests/entities/part-request.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToOne,
} from 'typeorm';
import { Order } from '../../order-workflow/entities/order.entity';
import { Attachment } from '../../order-findings/entities/attachment.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
import { PartRequestPayment } from './part-request-payment.entity';
import { PartRequestStatusHistory } from './part-request-status-history.entity';
import { PartRequestStatus, PartRequestType } from './enums/part-request-status.enum';
import { PartRequestSourcing } from './part-request-sourcing.entity';
import { PartRequestShipping } from './part-request-shipping.entity';
import { PartRequestArrival } from './part-request-arrival.entity';

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

    // ─── Quién solicitó ────────────────────────────────────────────
    @Column({ type: 'uuid' })
    technician_id!: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'technician_id' })
    technician!: UserEmployeeCache;

    @Column({ type: 'varchar', length: 500 })
    descripcion!: string;

    @Column({ type: 'enum', enum: PartRequestType, nullable: true })
    tipo?: PartRequestType;

    @Index()
    @Column({ type: 'enum', enum: PartRequestStatus, default: PartRequestStatus.SOLICITADO })
    estado!: PartRequestStatus;

    // ─── Quién está a cargo de la búsqueda ──────────────────────────
    @Column({ type: 'uuid', nullable: true })
    responsable_busqueda_id?: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true, nullable: true })
    @JoinColumn({ name: 'responsable_busqueda_id' })
    responsableBusqueda?: UserEmployeeCache;

    // ─── Quién está a cargo de recibir el pedido ────────────────────
    @Column({ type: 'uuid', nullable: true })
    responsable_recepcion_id?: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true, nullable: true })
    @JoinColumn({ name: 'responsable_recepcion_id' })
    responsableRecepcion?: UserEmployeeCache;

    @OneToMany(() => PartRequestPayment, (pago) => pago.partRequest, { cascade: true })
    pagos!: PartRequestPayment[];

    @OneToMany(() => PartRequestStatusHistory, (hist) => hist.partRequest, { cascade: true })
    historial!: PartRequestStatusHistory[];

    @OneToOne(() => PartRequestSourcing, (s) => s.partRequest)
    sourcing?: PartRequestSourcing;

    @OneToOne(() => PartRequestShipping, (s) => s.partRequest)
    shipping?: PartRequestShipping;

    @OneToOne(() => PartRequestArrival, (a) => a.partRequest)
    arrival?: PartRequestArrival;


    attachments?: Attachment[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}