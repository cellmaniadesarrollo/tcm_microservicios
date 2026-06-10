// src/orders-relay/entities/order-replica.entity.ts

import {
    Entity,
    Column,
    PrimaryColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { CustomerCache } from '../../customers-events/entities/customer-cache.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('order_replicas')
export class OrderReplica {
    @PrimaryColumn({ name: 'id' })
    id!: number;

    @Column({ name: 'public_id', nullable: true })
    publicId?: string;

    @Column({ name: 'order_number', nullable: true })  // ← nuevo
    orderNumber?: number;

    // ── Cliente ────────────────────────────────────────────────────────────────

    @Index()
    @Column({ name: 'customer_id' })
    customerId!: number;

    @ManyToOne(() => CustomerCache, { nullable: true, eager: false })
    @JoinColumn({ name: 'customer_id' })
    customer?: CustomerCache;

    // ── Dispositivo ────────────────────────────────────────────────────────────

    @Column({ name: 'device_id', nullable: true })
    deviceId?: number;

    @Column({ name: 'device_label', nullable: true })
    deviceLabel?: string;

    @Column({ name: 'device_brand', nullable: true })
    deviceBrand?: string;

    @Column({ name: 'device_model', nullable: true })
    deviceModel?: string;

    // ── Estado actual ──────────────────────────────────────────────────────────

    @Index()
    @Column({ name: 'status_id' })
    statusId!: number;

    @Column({ name: 'status_name' })
    statusName!: string;

    @Column({ name: 'status_history', type: 'jsonb', default: '[]' })
    statusHistory!: {
        id: number;
        name: string;
        changedAt: string;
    }[];

    // ── Tipo de orden ──────────────────────────────────────────────────────────

    @Column({ name: 'type_id', nullable: true })
    typeId!: number;

    @Column({ name: 'type_name', nullable: true })
    typeName!: string;

    // ── Timestamps remotos ─────────────────────────────────────────────────────

    @Index()
    @Column({ name: 'remote_created_at', nullable: true })
    remoteCreatedAt!: Date;

    @Index()
    @Column({ name: 'remote_updated_at', nullable: true })
    remoteUpdatedAt!: Date;

    // ── Timestamps locales ─────────────────────────────────────────────────────

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
    // ── Empresa ────────────────────────────────────────────────────────────────
    @Index()
    @Column({ name: 'company_id', type: 'uuid', nullable: true })
    companyId?: string;

    @ManyToOne(() => CompanyReplica, { nullable: true, eager: false })
    @JoinColumn({ name: 'company_id' })
    company?: CompanyReplica;
}