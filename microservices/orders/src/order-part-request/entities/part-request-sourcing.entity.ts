// microservices/orders/src/order-part-requests/entities/part-request-sourcing.entity.ts

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

@Entity('part_request_sourcing')
export class PartRequestSourcing {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    part_request_id!: number;

    @OneToOne(() => PartRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

    @Column({ nullable: true })
    proveedor?: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    precio?: number;

    @Column({ type: 'int', default: 1 })
    cantidad!: number;

    @Column({ nullable: true })
    contacto_proveedor?: string;

    @Column({ nullable: true })
    link_compra?: string;

    @Column({ type: 'text', nullable: true })
    notas?: string;

    @Column({ type: 'uuid' })
    registrado_por_id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}