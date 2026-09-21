// microservices/orders/src/order-part-requests/entities/part-request-shipping.entity.ts

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

@Entity('part_request_shipping')
export class PartRequestShipping {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    part_request_id!: number;

    @OneToOne(() => PartRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

    @Column()
    transportista!: string;

    @Column()
    numero_guia!: string;

    @Column({ type: 'date', nullable: true })
    fecha_estimada_llegada?: Date;

    @Column({ type: 'text', nullable: true })
    notas?: string;

    @Column({ type: 'uuid' })
    registrado_por_id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}