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

    @Column({ type: 'text', nullable: true })
    observations?: string;

    @Column({ type: 'uuid' })
    registrado_por_id!: string;

    // ─── Resultado de la validación ──────────────────────────────
    @Column({
        type: 'enum',
        enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'LITIGIO'], // CAMBIO: se agregó LITIGIO
        default: 'PENDIENTE',
    })
    resultado_validacion!: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'LITIGIO'; // CAMBIO

    @Column({ type: 'timestamp', nullable: true })
    fecha_validacion?: Date;

    @Column({ type: 'uuid', nullable: true })
    validado_por_id?: string;

    @Column({ type: 'text', nullable: true })
    motivo_rechazo?: string;

    // NUEVO: categoría estructurada del motivo (rechazo o litigio), para clasificar proveedores a futuro
    @Column({
        type: 'enum',
        enum: ['PRODUCTO_INCORRECTO', 'CALIDAD_DEFICIENTE', 'DAÑADO_EN_TRANSITO', 'CANTIDAD_INCOMPLETA', 'OTRO'],
        nullable: true,
    })
    motivo_categoria?: 'PRODUCTO_INCORRECTO' | 'CALIDAD_DEFICIENTE' | 'DAÑADO_EN_TRANSITO' | 'CANTIDAD_INCOMPLETA' | 'OTRO';

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}