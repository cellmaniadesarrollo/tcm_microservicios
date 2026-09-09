// microservices/orders/src/order-part-requests/entities/part-request-arrival.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { PartRequest } from './part-request.entity';

@Entity('part_request_arrivals')
export class PartRequestArrival {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    part_request_id!: number;

    @OneToOne(() => PartRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

    @Column({ type: 'int', default: 1 })
    cantidad!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    precio_venta?: number;

    // ─── Texto plano, sin FK a catálogo ──────────────────────────
    @Column({ nullable: true })
    marca?: string;

    @Column({ nullable: true })
    modelo?: string;

    @Column({ nullable: true })
    tipo?: string;

    @Column({ nullable: true })
    color?: string;

    @Column({ nullable: true })
    calidad?: string;

    @Column({ type: 'text', nullable: true })
    observations?: string;

    @Column({ type: 'uuid' })
    registrado_por_id!: string;

    // ─── Resultado de la validación ──────────────────────────────
    @Column({
        type: 'enum',
        enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO'],
        default: 'PENDIENTE',
    })
    resultado_validacion!: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

    @Column({ type: 'timestamp', nullable: true })
    fecha_validacion?: Date;

    @Column({ type: 'uuid', nullable: true })
    validado_por_id?: string;

    @Column({ type: 'text', nullable: true })
    motivo_rechazo?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}